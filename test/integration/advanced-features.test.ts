import { describe, expect, it } from "bun:test";
import { encode, decode } from "@msgpack/msgpack";
import { MetaBunApp } from "../../src/ts/index";
import { join } from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import type { GameEvent } from "../../src/ts/shared/types/events";

describe("İleri Düzey Özellikler Entegrasyon Testleri", () => {
	it("Sıcak-yenileme (hot-reload) esnasında GetState ve SetState kullanarak eklenti durum bilgisini (state) korumalıdır", async () => {
		const port = 9123;
		const app = new MetaBunApp(port);
		const pluginManager = app.GetPluginManager();
		
		const pluginsFolder = join(process.cwd(), "plugins");
		if (!require("node:fs").existsSync(pluginsFolder)) mkdirSync(pluginsFolder);
		
		const fileName = "hot_reload_test.ts";
		const filePath = join(pluginsFolder, fileName);
		
		const code1 = `
			import { BasePlugin, GetState, SetState } from "meta-bun";
			export default class extends BasePlugin {
				OnLoad() {
					const count = GetState("count", 0);
					SetState("count", count + 1);
				}
			}
		`;
		
		writeFileSync(filePath, code1);
		await pluginManager.LoadPlugin(fileName);
		
		let stateVal = pluginManager.GetPluginContext("hot_reload_test.ts")?.GetState("count", 0);
		expect(stateVal).toBe(1);
		
		// Reload
		await pluginManager.LoadPlugin(fileName);
		stateVal = pluginManager.GetPluginContext("hot_reload_test.ts")?.GetState("count", 0);
		expect(stateVal).toBe(2);

		// Clean up
		await pluginManager.UnloadPlugin(fileName);
		rmSync(filePath);
	});

	it("Uzunluk ön ekli MessagePack protokolü kullanarak yüksek performanslı veri iletişimini sağlayabilmelidir", async () => {
		process.env.BRIDGE_PROTOCOL = "length_prefixed_msgpack";
		const port = 9124;
		
		let received: any[] = [];
		const mockServer = Bun.listen({
			hostname: "127.0.0.1",
			port,
			socket: {
				data(socket, data) {
					let buffer = (socket as any).buffer || Buffer.alloc(0);
					buffer = Buffer.concat([buffer, data]);
					while (buffer.length >= 4) {
						const len = buffer.readUInt32BE(0);
						if (buffer.length >= 4 + len) {
							received.push(decode(buffer.subarray(4, 4 + len)));
							buffer = buffer.subarray(4 + len);
						} else break;
					}
					(socket as any).buffer = buffer;
				}
			}
		});

		const app = new MetaBunApp(port);
		await app.Start();
		
		// Wait for connection
		await new Promise(r => setTimeout(r, 200));

		await app.Stop();
		mockServer.stop();
		delete process.env.BRIDGE_PROTOCOL;

		expect(received.length).toBeGreaterThan(0);
	});

	it("128 tickrate değerinde bir oyun döngüsü çalıştırarak GameFrame olaylarını tetiklemelidir", async () => {
		const port = 9125;
		const app = new MetaBunApp(port);

		const frames: any[] = [];
		app.GetPluginManager().on("GameFrame", (data: any) => {
			frames.push(data);
		});

		await app.Start();
		// Wait for ~5 ticks
		await new Promise((resolve) => setTimeout(resolve, 50));
		await app.Stop();

		expect(frames.length).toBeGreaterThan(2);
		expect(frames[0].event).toBe("GameFrame");
		expect(frames[0].tick).toBeDefined();
	});

	it("Asenkron görevleri başarıyla çalıştırmalı ve senkron görevleri reddetmelidir", async () => {
		const port = 9126;
		const app = new MetaBunApp(port);
		const { Task } = await import("../../src/ts/natives/core");

		let asyncExecuted = false;
		Task.Run(async () => {
			await new Promise((r) => setTimeout(r, 10));
			asyncExecuted = true;
		});

		// Wait for async task
		await new Promise((resolve) => setTimeout(resolve, 30));
		expect(asyncExecuted).toBe(true);

		// Synchronous task should log error
		const origConsoleError = console.error;
		let caughtError = "";
		console.error = (msg: string) => {
			caughtError = msg;
		};

		(Task as any).Run(() => {
			return "not a promise";
		});

		await new Promise((resolve) => setTimeout(resolve, 10));
		console.error = origConsoleError;

		expect(caughtError).not.toBe("");
		expect(caughtError).toContain("Action must be an asynchronous function");
	});
});
