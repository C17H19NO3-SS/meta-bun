import { describe, it, expect, afterAll } from "bun:test";
import { Player } from "../../src/ts/players/player";
import { Bridge } from "../../src/ts/network/bridge";
import { AdminManager } from "../../src/ts/admins/manager";
import { BanManager } from "../../src/ts/admins/bans";
import { DatabaseManager } from "../../src/ts/shared/database";
import { Team } from "../../src/ts/shared/types/enums";
import type { GameAction } from "../../src/ts/shared/types/bridge";

describe("Oyuncu (Player) Birim Testleri", () => {
  afterAll(() => {
    db.close();
  });
  const dbPath = "./test_meta_bun.db";
  let db: DatabaseManager;
  let adminManager: AdminManager;
  let banManager: BanManager;
  let bridge: Bridge;

  db = new DatabaseManager(dbPath);
  adminManager = new AdminManager();
  banManager = new BanManager(db);
  bridge = new Bridge();

  it("Varsayılan istatistikleri doğru şekilde başlatmalı ve güncellemeleri yansıtmalıdır", () => {
    const player = new Player(bridge, adminManager, banManager, 1, "TestPlayer", "STEAM_0:0:1", 100);

    expect(player.GetHealth()).toBe(100);
    expect(player.GetArmor()).toBe(0);
    expect(player.GetMoney()).toBe(0);
    expect(player.GetTeam()).toBe(Team.Unassigned);
    expect(player.GetKills()).toBe(0);
    expect(player.GetDeaths()).toBe(0);
    expect(player.GetAssists()).toBe(0);
    expect(player.IsAlive()).toBe(true);

    player.UpdateHealth(75);
    player.UpdateArmor(50);
    player.UpdateMoney(4000);
    player.UpdateTeam(Team.Terrorist);
    player.UpdateKills(5);
    player.UpdateDeaths(2);
    player.UpdateAssists(3);

    expect(player.GetHealth()).toBe(75);
    expect(player.GetArmor()).toBe(50);
    expect(player.GetMoney()).toBe(4000);
    expect(player.GetTeam()).toBe(Team.Terrorist);
    expect(player.GetKills()).toBe(5);
    expect(player.GetDeaths()).toBe(2);
    expect(player.GetAssists()).toBe(3);
  });

  it("Oyuncu durum güncellemelerinde ilgili olay geri çağırmalarını (event callback) tetiklemelidir", () => {
    const player = new Player(bridge, adminManager, banManager, 1, "EventPlayer", "STEAM_0:0:2", 200);
    
    let healthChange = -1;
    let teamChange = -1;
    let weaponChange = "";
    let deathFired = false;

    player.on("HealthChange", (val) => healthChange = val);
    player.on("TeamChange", (val) => teamChange = val);
    player.on("WeaponChange", (val) => weaponChange = val);
    player.on("Death", () => deathFired = true);

    player.UpdateHealth(90);
    expect(healthChange).toBe(90);

    player.UpdateTeam(Team.CT);
    expect(teamChange).toBe(Team.CT);

    player.GiveWeapon("weapon_ak47");
    expect(weaponChange).toBe("weapon_ak47");

    player.UpdateIsAlive(false);
    expect(deathFired).toBe(true);
  });

  it("Silah envanterini ve silah sahipliği takibini doğru şekilde yönetmelidir", () => {
    const player = new Player(bridge, adminManager, banManager, 1, "InvPlayer", "STEAM_0:0:3", 300);

    expect(player.GetWeapon()).toBe("");
    expect(player.HasWeapon("weapon_ak47")).toBe(false);

    player.GiveWeapon("weapon_ak47", { clip: 30, reserve: 90 });
    expect(player.GetWeapon()).toBe("weapon_ak47");
    expect(player.HasWeapon("weapon_ak47")).toBe(true);

    const inv = player.GetInventory();
    expect(inv.size).toBe(1);
    expect(inv.get("weapon_ak47")).toEqual({ clip: 30, reserve: 90 });

    player.GiveWeapon("weapon_deagle");
    expect(player.GetWeapon()).toBe("weapon_deagle");
    expect(player.HasWeapon("weapon_deagle")).toBe(true);

    player.RemoveWeapon("weapon_ak47");
    expect(player.HasWeapon("weapon_ak47")).toBe(false);
    expect(player.HasWeapon("weapon_deagle")).toBe(true);
  });

  it("Oyuncunun boşta kalma (idle) süresini hesaplamalı ve etkileşimlerde bu süreyi sıfırlamalıdır", () => {
    const player = new Player(bridge, adminManager, banManager, 1, "IdlePlayer", "STEAM_0:0:4", 400);

    expect(player.GetIdleTime()).toBe(0);

    // Manually skew lastActiveTime back for testing
    (player as any)._lastActiveTime = Date.now() - 10000;
    expect(player.GetIdleTime()).toBeGreaterThanOrEqual(10);

    // Reset via Say
    player.Say("active");
    expect(player.GetIdleTime()).toBe(0);
  });

  it("Admin yetkilerini ve hedef alma bağışıklık (immunity) kısıtlamalarını doğrulamalıdır", () => {
    adminManager.SetFlags("STEAM_ADMIN", "ad");
    adminManager.SetImmunity("STEAM_ADMIN", 50);
    adminManager.SetImmunity("STEAM_ROOT", 99);

    const admin = new Player(bridge, adminManager, banManager, 1, "Admin", "STEAM_ADMIN", 500);
    const root = new Player(bridge, adminManager, banManager, 2, "Root", "STEAM_ROOT", 600);
    const user = new Player(bridge, adminManager, banManager, 3, "User", "STEAM_USER", 700);

    expect(admin.HasFlag("a")).toBe(true);
    expect(admin.HasFlag("z")).toBe(false);
    expect(user.HasFlag("a")).toBe(false);

    // Targeting constraints
    expect(root.CanTarget(admin)).toBe(true);
    expect(admin.CanTarget(user)).toBe(true);
    expect(admin.CanTarget(root)).toBe(false);
  });

  it("Oyuncunun IP adresi yasaklandığında IsBanned kontrolünü doğru yapmalı, ayrıca admin bayrak ve bağışıklık düzeylerini alabilmelidir", () => {
    // 1. IP Ban checks
    const targetIp = "192.168.1.50";
    banManager.BanClient("STEAM_BANNED_IP", "IP Ban test", "STEAM_ADMIN", 0, targetIp);

    const bannedPlayer = new Player(bridge, adminManager, banManager, 4, "BannedPlayer", "STEAM_BANNED_IP", 800);
    bannedPlayer.SetIPAddress(targetIp);
    expect(bannedPlayer.IsBanned()).toBe(true);

    const cleanPlayer = new Player(bridge, adminManager, banManager, 5, "CleanPlayer", "STEAM_CLEAN", 900);
    cleanPlayer.SetIPAddress("192.168.1.51");
    expect(cleanPlayer.IsBanned()).toBe(false);

    // 2. Admin Getters
    adminManager.SetFlags("STEAM_ADMIN_GET", "bcd");
    adminManager.SetImmunity("STEAM_ADMIN_GET", 75);

    const adminPlayer = new Player(bridge, adminManager, banManager, 6, "AdminGet", "STEAM_ADMIN_GET", 1000);
    expect(adminPlayer.GetAdminFlags()).toBe("bcd");
    expect(adminPlayer.GetAdminImmunity()).toBe(75);

    // Cleanup ban
    banManager.RemoveBan("STEAM_BANNED_IP");
  });
});
