import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { DatabaseManager } from "../../src/ts/shared/database";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { Bridge } from "../../src/ts/network/bridge";
import { AdminManager } from "../../src/ts/admins/manager";
import { BanManager } from "../../src/ts/admins/bans";
import fs from "fs";

describe("Veritabanı Entegrasyon Testleri", () => {
  const dbPath = "./test_meta_bun.db";
  let db: DatabaseManager;
  let playerManager: PlayerManager;
  let adminManager: AdminManager;
  let banManager: BanManager;
  let bridge: Bridge;

  beforeAll(() => {
    db = new DatabaseManager(dbPath);
    db.clearAll();
    playerManager = new PlayerManager(db, false);
    adminManager = new AdminManager();
    banManager = new BanManager(db);
    bridge = new Bridge();
  });

  afterAll(() => {
    db.close();
  });

  it("Oyuncu istatistiklerini gerçek SQLite veritabanına kaydedip kalıcı hale getirmelidir", () => {
    const player = new Player(bridge, adminManager, banManager, 1, "RealPlayer", "STEAM_123", 100);
    player.SetTotalStats(10, 5, 2);
    playerManager.AddPlayer(player);
    playerManager.RemovePlayer(1);

    const data = db.GetPlayer("STEAM_123");
    expect(data).toBeDefined();
    expect(data?.total_kills).toBe(10);
    expect(data?.total_deaths).toBe(5);
    expect(data?.total_assists).toBe(2);
  });

  it("Aynı oyuncunun birden fazla kaydedilmesinde istatistikleri birikimli (toplayarak) saklamalıdır", () => {
    // Reset DB for this test
    db.UpsertPlayer({ steamid: "STEAM_123", last_name: "X", total_kills: 0, total_deaths: 0, total_assists: 0 });

    const player1 = new Player(bridge, adminManager, banManager, 1, "RealPlayer", "STEAM_123", 100);
    player1.SetTotalStats(10, 5, 2);
    playerManager.AddPlayer(player1);
    playerManager.RemovePlayer(1);

    // Save again with new stats (10 more kills)
    const player2 = new Player(bridge, adminManager, banManager, 1, "RealPlayer", "STEAM_123", 100);
    player2.SetTotalStats(10, 5, 2);
    playerManager.AddPlayer(player2);
    playerManager.RemovePlayer(1);

    const data = db.GetPlayer("STEAM_123");
    expect(data?.total_kills).toBe(30);
    expect(data?.total_deaths).toBe(15);
    expect(data?.total_assists).toBe(6);
  });

  it("SQL tabanlı ban kontrollerini uygulayarak yasaklı oyuncuların bağlantısını reddetmelidir", async () => {
    const steamId = "STEAM_BAN_CHECK";
    
    expect(await banManager.CheckBan(steamId)).toBe(false);

    await banManager.BanClient(steamId, "Hacking", "STEAM_0:0:99", 60);
    expect(await banManager.CheckBan(steamId)).toBe(true);

    const toxicPlayer = new Player(bridge, adminManager, banManager, 1, "ToxicGuy", steamId, 201);
    expect(await toxicPlayer.IsBanned()).toBe(true);

    await banManager.RemoveBan(steamId);
    expect(await banManager.CheckBan(steamId)).toBe(false);
  });
});
