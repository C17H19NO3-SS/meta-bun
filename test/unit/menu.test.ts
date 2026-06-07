import { describe, it, expect, afterAll } from "bun:test";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { PlayerManager } from "../../src/ts/players/manager";
import { AdminManager } from "../../src/ts/admins/manager";
import { BanManager } from "../../src/ts/admins/bans";
import { DatabaseManager } from "../../src/ts/shared/database";
import { Player } from "../../src/ts/players/player";
import { Bridge } from "../../src/ts/network/bridge";
import type { GameAction } from "../../src/ts/shared/types/bridge";

describe("Menü ve Oylama Sistemi Birim Testleri", () => {
  afterAll(() => {
    db.close();
  });
  const dbPath = "./test_meta_bun.db";
  let db: DatabaseManager;
  let banManager: BanManager;
  let bridge: Bridge;
  let playerManager: PlayerManager;
  let adminManager: AdminManager;
  let pluginManager: PluginManager;
  let context: PluginContext;

  db = new DatabaseManager(dbPath);
  banManager = new BanManager(db);
  bridge = new Bridge();
  playerManager = new PlayerManager(db, false);
  adminManager = new AdminManager();
  pluginManager = new PluginManager(bridge, playerManager, adminManager, false);
  
  context = new PluginContext(
    "TestPlugin",
    pluginManager,
    bridge,
    playerManager,
    adminManager,
    {
      RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
      UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager)
    }
  );

  it("Yeni menü oluşturabilmeli, öğe ekleyebilmeli ve bunları istemcilere gösterebilmelidir", () => {
    let lastMenuAction: any = null;
    bridge.Send = (action: GameAction) => {
      if (action.action === "menu") {
        lastMenuAction = action;
      }
    };

    let selectedInfo = "";
    let selectedClient = -1;

    const menu = context.CreateMenu("Harita Sec", (client, info) => {
      selectedClient = client;
      selectedInfo = info;
    });

    menu.AddItem("dust2", "de_dust2");
    menu.AddItem("inferno", "de_inferno");
    menu.Display(1);

    expect(lastMenuAction).toBeDefined();
    expect(lastMenuAction.menu_title).toBe("Harita Sec");
    expect(JSON.parse(lastMenuAction.menu_items_json)).toEqual([
      { info: "dust2", display: "de_dust2" },
      { info: "inferno", display: "de_inferno" }
    ]);

    // Simulate callback
    pluginManager.emit("MenuSelect", {
      client: 1,
      menuId: lastMenuAction.menu_id,
      info: "dust2"
    });

    expect(selectedClient).toBe(1);
    expect(selectedInfo).toBe("dust2");
  });

  it("Geri çağırma (callback) fonksiyonları ile oylama sistemini desteklemelidir", async () => {
    const p1 = new Player(bridge, adminManager, banManager, 1, "P1", "STEAM_P1", 901);
    const p2 = new Player(bridge, adminManager, banManager, 2, "P2", "STEAM_P2", 902);
    playerManager.AddPlayer(p1);
    playerManager.AddPlayer(p2);

    let lastMenuId = "";
    bridge.Send = (action: GameAction) => {
      if (action.action === "menu") {
        lastMenuId = (action as any).menu_id || "";
      }
    };

    const votePromise = new Promise<Record<string, number>>((resolve) => {
      context.CreateVote("Silah ne olsun?", ["ak47", "m4a1"], (results) => {
        resolve(results);
      }, 50); // 50ms vote duration
    });

    // Simulate voting
    pluginManager.emit("MenuSelect", { client: 1, menuId: lastMenuId, info: "ak47" });
    pluginManager.emit("MenuSelect", { client: 2, menuId: lastMenuId, info: "m4a1" });

    const results = await votePromise;
    expect(results["ak47"]).toBe(1);
    expect(results["m4a1"]).toBe(1);
  });
});
