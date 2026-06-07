import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ProcessTargetString, CanAdminTarget } from "../../src/ts/natives/player";
import { pluginContextStore } from "../../src/ts/shared/context-store";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { PlayerManager } from "../../src/ts/players/manager";
import { AdminManager } from "../../src/ts/admins/manager";
import { BanManager } from "../../src/ts/admins/bans";
import { DatabaseManager } from "../../src/ts/shared/database";
import { Player } from "../../src/ts/players/player";
import { Bridge } from "../../src/ts/network/bridge";
import { Team } from "../../src/ts/shared/types/enums";
import { rmSync, existsSync } from "fs";

describe("Hedefleme Filtreleri (Target Filters) Birim Testleri", () => {
  const dbPath = "./test_meta_bun.db";
  let db: DatabaseManager;
  let banManager: BanManager;
  let bridge: Bridge;
  let playerManager: PlayerManager;
  let adminManager: AdminManager;
  let pluginManager: PluginManager;
  let context: PluginContext;

  beforeAll(() => {
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
      {} as any
    );

    // Mock native context details
    context.GetMaxClients = () => 32;
    context.IsClientInGame = (client) => {
      return playerManager.Get(client) !== undefined;
    };

    // Add mock players:
    // 1. "Alice" - Human - CT - Alive (UserID: 101)
    const p1 = new Player(bridge, adminManager, banManager, 1, "Alice", "STEAM_A", 101, false);
    p1.UpdateTeam(Team.CT);
    p1.UpdateIsAlive(true);
    playerManager.AddPlayer(p1);

    // 2. "Bob" - Human - Terrorist - Dead (UserID: 102)
    const p2 = new Player(bridge, adminManager, banManager, 2, "Bob", "STEAM_B", 102, false);
    p2.UpdateTeam(Team.Terrorist);
    p2.UpdateIsAlive(false);
    playerManager.AddPlayer(p2);

    // 3. "Bot_John" - Bot - CT - Alive (UserID: 103)
    const p3 = new Player(bridge, adminManager, banManager, 3, "Bot_John", "STEAM_C", 103, true);
    p3.UpdateTeam(Team.CT);
    p3.UpdateIsAlive(true);
    playerManager.AddPlayer(p3);

    // 4. "Bot_Sally" - Bot - Terrorist - Dead (UserID: 104)
    const p4 = new Player(bridge, adminManager, banManager, 4, "Bot_Sally", "STEAM_D", 104, true);
    p4.UpdateTeam(Team.Terrorist);
    p4.UpdateIsAlive(false);
    playerManager.AddPlayer(p4);
  });

  afterAll(() => {
    db.close();
  });

  it("Hedef filtreleme kalıplarını ve özel etiketleri (@all, @ct, @t vb.) doğru şekilde çözümlemelidir", () => {
    pluginContextStore.run(context, () => {
      // @all
      expect(ProcessTargetString(1, "@all")).toEqual([1, 2, 3, 4]);
      expect(ProcessTargetString(1, "*")).toEqual([1, 2, 3, 4]);

      // @ct
      expect(ProcessTargetString(1, "@ct")).toEqual([1, 3]);

      // @t
      expect(ProcessTargetString(1, "@t")).toEqual([2, 4]);

      // @alive
      expect(ProcessTargetString(1, "@alive")).toEqual([1, 3]);

      // @dead
      expect(ProcessTargetString(1, "@dead")).toEqual([2, 4]);

      // @me
      expect(ProcessTargetString(1, "@me")).toEqual([1]);
      expect(ProcessTargetString(2, "@me")).toEqual([2]);
      expect(ProcessTargetString(0, "@me")).toEqual([]); // Admin client is server console

      // !@me
      expect(ProcessTargetString(1, "!@me")).toEqual([2, 3, 4]);
      expect(ProcessTargetString(2, "@!me")).toEqual([1, 3, 4]);

      // @bots
      expect(ProcessTargetString(1, "@bots")).toEqual([3, 4]);

      // @humans
      expect(ProcessTargetString(1, "@humans")).toEqual([1, 2]);
    });
  });

  it("Hedef belirtilmediğinde veya doğrudan eşleşme (ID, isim vb.) arandığında doğru oyuncuları bulmalıdır", () => {
    pluginContextStore.run(context, () => {
      // Client ID
      expect(ProcessTargetString(1, "1")).toEqual([1]);
      expect(ProcessTargetString(1, "3")).toEqual([3]);
      expect(ProcessTargetString(1, "99")).toEqual([]); // Non-existent index

      // UserID (#102)
      expect(ProcessTargetString(1, "#102")).toEqual([2]);
      expect(ProcessTargetString(1, "#104")).toEqual([4]);
      expect(ProcessTargetString(1, "#999")).toEqual([]);

      // Exact name matching
      expect(ProcessTargetString(1, "Alice")).toEqual([1]);
      expect(ProcessTargetString(1, "Bot_John")).toEqual([3]);

      // Case-insensitive name matching
      expect(ProcessTargetString(1, "bob")).toEqual([2]);

      // Partial name matching
      expect(ProcessTargetString(1, "ali")).toEqual([1]); // matches Alice
      expect(ProcessTargetString(1, "bot")).toEqual([3, 4]); // matches Bot_John, Bot_Sally
    });
  });

  it("Admin bağışıklık düzeyine göre CanAdminTarget denetimlerini doğru şekilde yapmalıdır", () => {
    pluginContextStore.run(context, () => {
      // Set immunities for players
      adminManager.SetImmunity("STEAM_A", 10);
      adminManager.SetImmunity("STEAM_B", 50);

      // Console (client 0) can target anyone
      expect(CanAdminTarget(0, 1)).toBe(true);
      expect(CanAdminTarget(0, 2)).toBe(true);

      // Self-targeting is always allowed
      expect(CanAdminTarget(1, 1)).toBe(true);
      expect(CanAdminTarget(2, 2)).toBe(true);

      // Bob (immunity 50) can target Alice (immunity 10)
      expect(CanAdminTarget(2, 1)).toBe(true);

      // Alice (immunity 10) cannot target Bob (immunity 50)
      expect(CanAdminTarget(1, 2)).toBe(false);
    });
  });
});
