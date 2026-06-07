import { describe, expect, it } from "bun:test";
import { AdminManager } from "../../src/ts/admins/manager";
import { DatabaseManager } from "../../src/ts/shared/database";

describe("Admin Yöneticisi (AdminManager) Birim Testleri", () => {
	it("Yapılandırma dosyasındaki adminleri yüklemeli ve yetki kontrollerini doğru şekilde yapmalıdır", () => {
		const adminManager = new AdminManager();

		// Custom set flags for testing
		adminManager.SetFlags("STEAM_0:0:1", "a");
		adminManager.SetFlags("STEAM_ROOT", "z");

		expect(adminManager.GetFlags("STEAM_0:0:1")).toBe("a");
		expect(adminManager.GetFlags("STEAM_ROOT")).toBe("z");

		// Regular flag check
		expect(adminManager.HasPermission("STEAM_0:0:1", "a")).toBe(true);
		expect(adminManager.HasPermission("STEAM_0:0:1", "z")).toBe(false);

		// Root flag 'z' overrides all permission checks
		expect(adminManager.HasPermission("STEAM_ROOT", "a")).toBe(true);
		expect(adminManager.HasPermission("STEAM_ROOT", "z")).toBe(true);
	});

	it("Tanımlı olmayan bilinmeyen kullanıcılar için boş yetki döndürmeli ve izin vermemelidir", () => {
		const adminManager = new AdminManager();
		expect(adminManager.GetFlags("STEAM_UNKNOWN")).toBe("");
		expect(adminManager.HasPermission("STEAM_UNKNOWN", "a")).toBe(false);
	});

	it("Admin bağışıklık derecelerini (immunity) ve hedef alabilme hiyerarşisini desteklemelidir", () => {
		const adminManager = new AdminManager();

		adminManager.SetImmunity("STEAM_ROOT", 99);
		adminManager.SetImmunity("STEAM_VIP", 50);
		adminManager.SetImmunity("STEAM_PLAYER", 0);

		expect(adminManager.GetImmunity("STEAM_ROOT")).toBe(99);
		expect(adminManager.GetImmunity("STEAM_VIP")).toBe(50);
		expect(adminManager.GetImmunity("STEAM_PLAYER")).toBe(0);
		expect(adminManager.GetImmunity("STEAM_UNKNOWN")).toBe(0);

		// canTarget checks
		expect(adminManager.CanTarget("STEAM_ROOT", "STEAM_VIP")).toBe(true);
		expect(adminManager.CanTarget("STEAM_ROOT", "STEAM_PLAYER")).toBe(true);
		expect(adminManager.CanTarget("STEAM_VIP", "STEAM_PLAYER")).toBe(true);

		// Lower immunity cannot target higher immunity
		expect(adminManager.CanTarget("STEAM_VIP", "STEAM_ROOT")).toBe(false);
		expect(adminManager.CanTarget("STEAM_PLAYER", "STEAM_VIP")).toBe(false);
		expect(adminManager.CanTarget("STEAM_UNKNOWN", "STEAM_VIP")).toBe(false);
	});

	it("Admin grupları, grup kalıtımı, komut yetki ezme ve çalışma zamanı API'lerini desteklemelidir", () => {
		const adminManager = new AdminManager();

		// 1. Group configuration and assignment
		adminManager.AddAdminGroup("VIP", "a", 50);
		adminManager.AddAdminGroup("Admin", "bc", 85, "VIP"); // Inherits VIP

		// Assign "STEAM_ADMIN_USER" to "Admin" group
		(adminManager as any).adminGroups.set("STEAM_ADMIN_USER", ["Admin"]);

		// Flags check (should inherit "a" from "VIP" and have "b", "c" from "Admin")
		expect(adminManager.HasPermission("STEAM_ADMIN_USER", "b")).toBe(true);
		expect(adminManager.HasPermission("STEAM_ADMIN_USER", "c")).toBe(true);
		expect(adminManager.HasPermission("STEAM_ADMIN_USER", "a")).toBe(true); // Inherited flag
		expect(adminManager.HasPermission("STEAM_ADMIN_USER", "d")).toBe(false);
		expect(adminManager.GetImmunity("STEAM_ADMIN_USER")).toBe(85); // Inherited immunity

		// 2. Command override check
		expect(adminManager.GetCommandOverride("sm_slap")).toBeUndefined();
		(adminManager as any).commandOverrides.set("sm_slap", "o");
		expect(adminManager.GetCommandOverride("sm_slap")).toBe("o");

		// 3. Runtime API
		adminManager.CreateAdmin("STEAM_TEMP_ADMIN", "ad", 30);
		expect(adminManager.HasPermission("STEAM_TEMP_ADMIN", "a")).toBe(true);
		expect(adminManager.HasPermission("STEAM_TEMP_ADMIN", "d")).toBe(true);
		expect(adminManager.GetImmunity("STEAM_TEMP_ADMIN")).toBe(30);

		adminManager.RemoveAdmin("STEAM_TEMP_ADMIN");
		expect(adminManager.GetFlags("STEAM_TEMP_ADMIN")).toBe("");
	});

	it("Geçici (süreli) admin yetkilerini ve süre aşımı (expiration) kontrollerini yapmalıdır", async () => {
		const dbPath = "./test_meta_bun.db";
		const db = new DatabaseManager(dbPath);
		const adminManager = new AdminManager(db);

		const now = Math.floor(Date.now() / 1000);
		const expTime = now + 1; // Expires in 1 second

		// Create a temporary admin
		adminManager.CreateAdmin("STEAM_EXPIRE_ME", "abc", 40, expTime);
		expect(adminManager.HasPermission("STEAM_EXPIRE_ME", "a")).toBe(true);
		expect(adminManager.GetImmunity("STEAM_EXPIRE_ME")).toBe(40);

		// Wait for it to expire
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Now it should be expired and ignored (and cleaned up from memory and DB)
		expect(adminManager.HasPermission("STEAM_EXPIRE_ME", "a")).toBe(false);
		expect(adminManager.GetFlags("STEAM_EXPIRE_ME")).toBe("");
		expect(adminManager.GetImmunity("STEAM_EXPIRE_ME")).toBe(0);

		// Verify it is deleted from the SQLite DB as well
		const dbAdmins = db.GetDatabaseAdmins();
		expect(dbAdmins.some((a) => a.steamid === "STEAM_EXPIRE_ME")).toBe(false);

		db.close();
	});

	it("Çalışma zamanında dinamik komut yetki ezme (AddCommandOverride / RemoveCommandOverride) işlemlerini yapmalıdır", () => {
		const adminManager = new AdminManager();

		// Set an override
		adminManager.AddCommandOverride("sm_slap", "o");
		expect(adminManager.GetCommandOverride("sm_slap")).toBe("o");

		// Remove the override
		adminManager.RemoveCommandOverride("sm_slap");
		expect(adminManager.GetCommandOverride("sm_slap")).toBeUndefined();
	});
});
