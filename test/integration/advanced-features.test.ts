import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { PlayerManager } from "../../src/ts/players/manager";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { MetaBunApp } from "../../src/ts/index";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { encode, decode } from "@msgpack/msgpack";
import type { GameEvent } from "../../src/ts/shared/types/events";
import { Task } from "../../src/ts/natives/core";


describe("İleri Düzey Özellikler Entegrasyon Testleri", () => {
  const pluginsFolder = join(process.cwd(), "plugins_test_advanced");

  beforeAll(() => {
    if (!existsSync(pluginsFolder)) {
      mkdirSync(pluginsFolder, { recursive: true });
    }
  });

  afterAll(() => {
    rmSync(pluginsFolder, { recursive: true, force: true });
  });

  it("Sıcak-yenileme (hot-reload) esnasında GetState ve SetState kullanarak eklenti durum bilgisini (state) korumalıdır", async () => {
    const bridge = new Bridge();
    const playerManager = new PlayerManager();
    const adminManager = new AdminManager();
    const pluginManager = new PluginManager(bridge, playerManager, adminManager, false);
    (pluginManager as any).pluginsFolder = pluginsFolder;

    const pluginCode = `
      import { BasePlugin } from "meta-bun/core";

      export default class StateTestPlugin extends BasePlugin {
        name = "StateTestPlugin";
        version = "1.0.0";

        async OnLoad(game) {
          const counter = game.GetState("load_counter", 0);
          game.SetState("load_counter", counter + 1);
        }
      }
    `;

    const fileName = "state_test_plugin.ts";
    writeFileSync(join(pluginsFolder, fileName), pluginCode);

    // First load
    await pluginManager.LoadPlugin(fileName);
    let stateVal = pluginManager.GetPluginState("StateTestPlugin", "load_counter", 0);
    expect(stateVal).toBe(1);

    // Second load (simulating hot-reload)
    await pluginManager.LoadPlugin(fileName);
    stateVal = pluginManager.GetPluginState("StateTestPlugin", "load_counter", 0);
    expect(stateVal).toBe(2);

    // Clean up
    await pluginManager.UnloadPlugin(fileName);
    pluginManager.Stop();
  });

  it("Uzunluk ön ekli JSON protokolü kullanarak veri iletişimini sağlayabilmelidir", async () => {
    // Set environment variable for protocol
    process.env.BRIDGE_PROTOCOL = "length_prefixed_json";
    
    const port = 9123;
    const app = new MetaBunApp(port);
    await app.Start();

    // Setup client socket
    const clientPromise = new Promise<{ received: any[], socket: any }>((resolve, reject) => {
      const received: any[] = [];
      const socket = Bun.connect({
        hostname: "127.0.0.1",
        port,
        socket: {
          data(socket, data) {
            // Buffer accumulator
            let buffer = (socket as any).buffer || Buffer.alloc(0);
            buffer = Buffer.concat([buffer, data]);
            
            while (buffer.length >= 4) {
              const len = buffer.readUInt32BE(0);
              if (buffer.length >= 4 + len) {
                const payload = buffer.subarray(4, 4 + len);
                buffer = buffer.subarray(4 + len);
                received.push(JSON.parse(payload.toString("utf-8")));
              } else {
                break;
              }
            }
            (socket as any).buffer = buffer;
          },
          open(socket) {
            // Send length-prefixed PlayerChat event
            const event: GameEvent = { event: "PlayerChat", client: 1, text: "hello" };
            const payload = Buffer.from(JSON.stringify(event));
            const header = Buffer.alloc(4);
            header.writeUInt32BE(payload.length, 0);
            socket.write(Buffer.concat([header, payload]));

            // Wait a moment and resolve
            setTimeout(() => {
              resolve({ received, socket });
            }, 100);
          },
          error(socket, error) {
            reject(error);
          }
        }
      });
    });

    const { received, socket } = await clientPromise;
    socket.end();
    await app.Stop();
    delete process.env.BRIDGE_PROTOCOL;

    // Verify client received command/cvar registration messages, proving JSON protocol communication works
    expect(received.length).toBeGreaterThan(0);
  });

  it("Uzunluk ön ekli MessagePack protokolü kullanarak yüksek performanslı veri iletişimini sağlayabilmelidir", async () => {
    // Set environment variable for protocol
    process.env.BRIDGE_PROTOCOL = "length_prefixed_msgpack";
    
    const port = 9124;
    const app = new MetaBunApp(port);
    await app.Start();

    const clientPromise = new Promise<{ received: any[], socket: any }>((resolve, reject) => {
      const received: any[] = [];
      const socket = Bun.connect({
        hostname: "127.0.0.1",
        port,
        socket: {
          data(socket, data) {
            let buffer = (socket as any).buffer || Buffer.alloc(0);
            buffer = Buffer.concat([buffer, data]);
            
            while (buffer.length >= 4) {
              const len = buffer.readUInt32BE(0);
              if (buffer.length >= 4 + len) {
                const payload = buffer.subarray(4, 4 + len);
                buffer = buffer.subarray(4 + len);
                received.push(decode(payload));
              } else {
                break;
              }
            }
            (socket as any).buffer = buffer;
          },
          open(socket) {
            // Send length-prefixed MsgPack event
            const event: GameEvent = { event: "PlayerChat", client: 1, text: "msgpack" };
            const encoded = encode(event);
            const payload = Buffer.from(encoded.buffer, encoded.byteOffset, encoded.byteLength);
            const header = Buffer.alloc(4);
            header.writeUInt32BE(payload.length, 0);
            socket.write(Buffer.concat([header, payload]));

            // Check if server responds to command
            // Trigger server send
            setTimeout(() => {
              app.GetBridge().Send({ action: "say", text: "success" });
            }, 50);

            setTimeout(() => {
              resolve({ received, socket });
            }, 150);
          },
          error(socket, error) {
            reject(error);
          }
        }
      });
    });

    const { received, socket } = await clientPromise;
    socket.end();
    await app.Stop();
    delete process.env.BRIDGE_PROTOCOL;

    // Verify client received the length-prefixed MessagePack response
    expect(received.length).toBeGreaterThan(0);
    const sayMsg = received.find((msg: any) => msg.action === "say");
    expect(sayMsg).toBeDefined();
    expect(sayMsg.text).toBe("success");
  });

  it("128 tickrate değerinde bir oyun döngüsü çalıştırarak GameFrame olaylarını tetiklemelidir", async () => {
    const port = 9125;
    const app = new MetaBunApp(port);

    const frames: any[] = [];
    app.GetPluginManager().on("GameFrame", (data: any) => {
      frames.push(data);
    });

    await app.Start();

    // Wait a brief moment to allow ticks to execute (e.g. 50ms should give about 6 ticks at 128 tickrate)
    await new Promise(resolve => setTimeout(resolve, 50));

    await app.Stop();

    expect(frames.length).toBeGreaterThan(3);
    expect(frames[0].event).toBe("GameFrame");
    expect(frames[0].tick).toBe(1);
    expect(frames[0].time).toBeCloseTo(1 / 128, 4);
    expect(app.GetCurrentTick()).toBeGreaterThan(3);
    expect(app.GetEngineTime()).toBeGreaterThan(0);
  });

  it("Asenkron görevleri başarıyla çalıştırmalı ve senkron görevleri reddetmelidir", async () => {
    let taskCompleted = false;
    let taskResult = 0;

    Task.Run(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      taskCompleted = true;
      taskResult = 42;
    });

    expect(taskCompleted).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 30));
    expect(taskCompleted).toBe(true);
    expect(taskResult).toBe(42);

    let caughtError: any = null;
    const origConsoleError = console.error;
    console.error = (msg: string, ...args: any[]) => {
      if (msg.includes("[Task.Run]")) {
        caughtError = args[0] || msg;
      }
    };

    Task.Run((() => {
      return "sync-result";
    }) as any);

    await new Promise(resolve => setTimeout(resolve, 10));
    console.error = origConsoleError;

    expect(caughtError).not.toBeNull();
    expect(caughtError.toString()).toContain("Action must be an asynchronous function");
  });
});


