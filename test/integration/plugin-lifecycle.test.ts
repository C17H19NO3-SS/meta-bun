import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { PlayerManager } from "../../src/ts/players/manager";
import { AdminManager } from "../../src/ts/admins/manager";
import { BanManager } from "../../src/ts/admins/bans";
import { DatabaseManager } from "../../src/ts/shared/database";
import { Bridge } from "../../src/ts/network/bridge";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { Action } from "../../src/ts/shared/types/enums";

describe("Eklenti Yaşam Döngüsü Entegrasyon Testleri", () => {
  const dbPath = "./test_meta_bun.db";
  const pluginsFolder = join(process.cwd(), "plugins_test_lifecycle");
  
  let db: DatabaseManager;
  let banManager: BanManager;
  let bridge: Bridge;
  let playerManager: PlayerManager;
  let adminManager: AdminManager;
  let pluginManager: PluginManager;

  beforeAll(() => {
    if (!existsSync(pluginsFolder)) {
      mkdirSync(pluginsFolder, { recursive: true });
    }
    db = new DatabaseManager(dbPath);
    banManager = new BanManager(db);
    bridge = new Bridge();
    playerManager = new PlayerManager(db, false);
    adminManager = new AdminManager();
    
    pluginManager = new PluginManager(bridge, playerManager, adminManager, false);
    (pluginManager as any).pluginsFolder = pluginsFolder; // Override folder
  });

  afterAll(() => {
    pluginManager.Stop();
    db.close();
    rmSync(pluginsFolder, { recursive: true, force: true });
  });

  it("Global olay dinleyicisi tanımlanmış SourceMod tarzı fonksiyonel eklentileri yükleyebilmelidir", async () => {
    const code = `
      export let name = "FunctionalPlugin";
      export let version = "1.0.0";

      export function OnPluginStart() {
        console.log("[Functional] Started");
      }

      export function CustomEvent(data) {
        console.log("[Functional] CustomEvent received:", data.text);
      }
    `;

    writeFileSync(join(pluginsFolder, "functional.ts"), code);
    await pluginManager.LoadPlugin("functional.ts");

    expect((pluginManager as any).loadedPlugins.has("functional.ts")).toBe(true);

    let logs: string[] = [];
    const origLog = console.log;
    console.log = (...args) => { logs.push(args.join(" ")); };

    pluginManager.emit("CustomEvent", { event: "CustomEvent", text: "hello" });
    console.log = origLog;

    expect(logs.some(l => l.includes("CustomEvent received: hello"))).toBe(true);

    await pluginManager.UnloadPlugin("functional.ts");
    expect((pluginManager as any).loadedPlugins.has("functional.ts")).toBe(false);
  });

  it("Sınıf tabanlı eklentileri yükleyebilmeli ve eklenti devredışı bırakıldığında kaynakları temizlemelidir", async () => {
    const code = `
      import { BasePlugin } from "meta-bun/core";

      export default class ClassPlugin extends BasePlugin {
        name = "ClassPlugin";
        version = "1.0.0";

        async OnLoad(game) {
          game.RegConsoleCmd("sm_test", (client, args) => {
            game.PrintToChatAll("triggered");
          });
        }
      }
    `;

    writeFileSync(join(pluginsFolder, "class_plugin.ts"), code);
    await pluginManager.LoadPlugin("class_plugin.ts");

    expect((pluginManager as any).commands.has("sm_test")).toBe(true);

    await pluginManager.UnloadPlugin("class_plugin.ts");
    expect((pluginManager as any).commands.has("sm_test")).toBe(false);
  });

  it("Geri çağırma (callback) fonksiyonu Plugin_Stop döndürdüğünde tekrarlayan zamanlayıcıyı sonlandırmalıdır", async () => {
    const code = `
      import { BasePlugin, Plugin_Stop } from "meta-bun/core";

      export default class TimerPlugin extends BasePlugin {
        name = "TimerPlugin";
        version = "1.0.0";
        counter = 0;

        async OnLoad(game) {
          game.CreateTimer(10, () => {
            this.counter++;
            if (this.counter >= 3) {
              return Plugin_Stop;
            }
          }, true);
        }
      }
    `;

    writeFileSync(join(pluginsFolder, "timer_plugin.ts"), code);
    await pluginManager.LoadPlugin("timer_plugin.ts");

    const entry = (pluginManager as any).loadedPlugins.get("timer_plugin.ts");
    const pluginInstance = entry.plugin;

    // Allow timers to tick
    await new Promise(r => setTimeout(r, 60));

    expect(pluginInstance.counter).toBe(3);
    expect(entry.context.timers.size).toBe(0); // Timer is destroyed

    await pluginManager.UnloadPlugin("timer_plugin.ts");
  });

  it("Sınıf tabanlı eklentilerde On ile başlayan metotları otomatik olarak ilgili event hook dinleyicisine bağlamalıdır", async () => {
    const code = `
      import { BasePlugin } from "meta-bun/core";

      export default class AutoHookPlugin extends BasePlugin {
        name = "AutoHookPlugin";
        version = "1.0.0";
        receivedData = null;

        OnCustomEvent(data) {
          this.receivedData = data;
        }
      }
    `;

    writeFileSync(join(pluginsFolder, "auto_hook_plugin.ts"), code);
    await pluginManager.LoadPlugin("auto_hook_plugin.ts");

    const entry = (pluginManager as any).loadedPlugins.get("auto_hook_plugin.ts");
    const pluginInstance = entry.plugin;

    pluginManager.emit("CustomEvent", { event: "CustomEvent", payload: "ok" });
    expect(pluginInstance.receivedData).toEqual({ event: "CustomEvent", payload: "ok" });

    await pluginManager.UnloadPlugin("auto_hook_plugin.ts");
  });

  it("Klasör bazlı eklentileri (index.ts barındıran) doğru şekilde yükleyebilmelidir", async () => {
    const folderPath = join(pluginsFolder, "my_folder_plugin");
    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    const code = `
      import { BasePlugin } from "meta-bun/core";

      export default class FolderPlugin extends BasePlugin {
        name = "FolderPlugin";
        version = "2.0.0";
        receivedData = null;

        OnFolderEvent(data) {
          this.receivedData = data;
        }
      }
    `;

    writeFileSync(join(folderPath, "index.ts"), code);
    await pluginManager.LoadPlugin("my_folder_plugin");

    expect((pluginManager as any).loadedPlugins.has("my_folder_plugin")).toBe(true);

    const entry = (pluginManager as any).loadedPlugins.get("my_folder_plugin");
    const pluginInstance = entry.plugin;

    pluginManager.emit("FolderEvent", { event: "FolderEvent", val: 42 });
    expect(pluginInstance.receivedData).toEqual({ event: "FolderEvent", val: 42 });

    await pluginManager.UnloadPlugin("my_folder_plugin");
    expect((pluginManager as any).loadedPlugins.has("my_folder_plugin")).toBe(false);
  });

  it("Sınıf metotlarında Command, AdminCommand ve HookEvent dekoratörlerini kullanarak otomatik kayıt gerçekleştirebilmelidir", async () => {
    const code = `
      import { BasePlugin, Command, AdminCommand, HookEvent } from "meta-bun/core";

      export default class DecoratorPlugin extends BasePlugin {
        name = "DecoratorPlugin";
        version = "1.0.0";
        eventData = null;

        @Command("sm_dec_cmd", "Test decorated command")
        public DecCommand(client, args) {
          this.eventData = { type: "command", client, args };
        }

        @AdminCommand("sm_dec_admin", "z", "Test admin command")
        public DecAdmin(client, args) {
          this.eventData = { type: "admin", client, args };
        }

        @HookEvent("DecEvent")
        public OnDecEvent(data) {
          this.eventData = { type: "event", data };
        }
      }
    `;

    writeFileSync(join(pluginsFolder, "decorator_plugin.ts"), code);
    await pluginManager.LoadPlugin("decorator_plugin.ts");

    expect((pluginManager as any).commands.has("sm_dec_cmd")).toBe(true);
    expect((pluginManager as any).commands.has("sm_dec_admin")).toBe(true);

    const entry = (pluginManager as any).loadedPlugins.get("decorator_plugin.ts");
    const pluginInstance = entry.plugin;

    // Trigger command sm_dec_cmd
    const cmdInfo = (pluginManager as any).commands.get("sm_dec_cmd");
    cmdInfo.callback(5, ["arg1", "arg2"]);
    expect(pluginInstance.eventData).toEqual({ type: "command", client: 5, args: ["arg1", "arg2"] });

    // Trigger event DecEvent
    pluginManager.emit("DecEvent", { event: "DecEvent", value: 123 });
    expect(pluginInstance.eventData).toEqual({ type: "event", data: { event: "DecEvent", value: 123 } });

    await pluginManager.UnloadPlugin("decorator_plugin.ts");
    expect((pluginManager as any).commands.has("sm_dec_cmd")).toBe(false);
  });
});
