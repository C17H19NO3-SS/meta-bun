import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AdminMenu from "../../plugins/admin-menu";
import CoreCommands from "../../plugins/core-commands";
import PlayerCommands from "../../plugins/player-commands";
import VoteCommands from "../../plugins/vote-commands";
import { BanManager } from "../../src/ts/admins/bans";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { pluginContextStore } from "../../src/ts/shared/context-store";
import { DatabaseManager } from "../../src/ts/shared/database";
import { translationManager } from "../../src/ts/shared/translations";
import type { GameAction } from "../../src/ts/shared/types/bridge";
import { Team } from "../../src/ts/shared/types/enums";

describe("Kapsamlı Gerçek Zamanlı Sistem Entegrasyon Testi", () => {
	const dbPath = "./test_meta_bun.db";
	const translationsDir = `./test_ultimate_translations_${Date.now()}`;
	let db: DatabaseManager;
	let banManager: BanManager;
	let bridge: Bridge;
	let playerManager: PlayerManager;
	let adminManager: AdminManager;
	let pluginManager: PluginManager;

	beforeEach(() => {
		// Setup translations directory
		mkdirSync(translationsDir, { recursive: true });
		writeFileSync(
			join(translationsDir, "en.json"),
			JSON.stringify({
				stats_info: "Player: {0} | Kills: {1} | Deaths: {2}",
			}),
		);
		(translationManager as any).baseDir = translationsDir;

		db = new DatabaseManager(dbPath);
		db.clearAll();
		banManager = new BanManager(db);
		bridge = new Bridge();
		playerManager = new PlayerManager(db, false); // Manual checkpoint calls in test
		adminManager = new AdminManager();
		pluginManager = new PluginManager(
			bridge,
			playerManager,
			adminManager,
			false,
		);
	});

	afterEach(() => {
		db.close();
		rmSync(translationsDir, { recursive: true, force: true });
	});

	it("Oyuncu istatistiklerini belirli periyotlarla veritabanına otomatik kaydetmelidir (checkpoint)", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"StatsPlayer",
			"STEAM_0:0:99",
			10,
		);
		player.SetTotalStats(12, 4, 3);
		playerManager.AddPlayer(player);

		// Call checkpoint manually
		playerManager.Checkpoint();

		// Verify written to DB
		const data = db.GetPlayer("STEAM_0:0:99");
		expect(data).toBeDefined();
		expect(data?.last_name).toBe("StatsPlayer");
		expect(data?.total_kills).toBe(12);
		expect(data?.total_deaths).toBe(4);
		expect(data?.total_assists).toBe(3);
	});

	it("Oyuncu envanterini ve sahip olunan silahların takibini hatasız yapabilmelidir", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"WeaponGuy",
			"STEAM_0:0:101",
			11,
		);

		// Initial state
		expect(player.GetWeapon()).toBe("");
		expect(player.HasWeapon("weapon_ak47")).toBe(false);

		// Give weapon
		player.GiveWeapon("weapon_ak47", { clip: 30, reserve: 90 });
		expect(player.GetWeapon()).toBe("weapon_ak47");
		expect(player.HasWeapon("weapon_ak47")).toBe(true);

		const inv = player.GetInventory();
		expect(inv.size).toBe(1);
		expect(inv.get("weapon_ak47")).toEqual({ clip: 30, reserve: 90 });

		// Give another weapon
		player.GiveWeapon("weapon_deagle", { clip: 7, reserve: 35 });
		expect(player.GetWeapon()).toBe("weapon_deagle");
		expect(player.HasWeapon("weapon_ak47")).toBe(true);
		expect(player.HasWeapon("weapon_deagle")).toBe(true);

		// Remove weapon
		player.RemoveWeapon("weapon_ak47");
		expect(player.HasWeapon("weapon_ak47")).toBe(false);
		expect(player.HasWeapon("weapon_deagle")).toBe(true);
	});

	it("sm_ping komutunu işleyebilmeli ve tüm oyunculara Pong mesajı yayınlayabilmelidir", async () => {
		const plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));

		const p = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Alice",
			"STEAM_A",
			101,
		);
		playerManager.AddPlayer(p);

		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		// Emit event, command handlers might be async, so we wait briefly
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!ping",
		});

		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(lastSay).toContain("[Gecikme Analizi (Latency Analysis)]");
		expect(lastSay).toContain("Oyuncu Gecikmesi (Player Ping)");
		expect(lastSay).toContain("Köprü Gecikmesi (Bridge Latency)");
		expect(lastSay).toContain("Veritabanı Sorgu Gecikmesi (DB Query Latency)");

		playerManager.RemovePlayer(1);
	});

	it("Raund sıfırlama (restart) yetkisini sadece admin veya sunucu konsolu ile sınırlandırmalıdır", async () => {
		const plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));

		const normal = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Player",
			"STEAM_0:0:1",
			1,
		);
		const admin = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"Admin",
			"STEAM_0:0:2",
			2,
		);
		playerManager.AddPlayer(normal);
		playerManager.AddPlayer(admin);

		adminManager.SetFlags("STEAM_0:0:2", "z");

		let lastCommand = "";
		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "command") {
				lastCommand = action.cmd || "";
			} else if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		// 1. Normal player triggers it -> Denied
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!restart",
		});
		expect(lastCommand).toBe("");
		expect(lastSay).toBe("(To Player) Yetkiniz yok");

		// Reset
		lastSay = "";

		// 2. Admin triggers it -> Allowed
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 2,
			text: "!restart",
		});
		expect(lastCommand).toBe("sv_restartround 1");
		expect(lastSay).toBe("Round restarted by admin.");
	});

	it("Oyuncu indeksine veya ismine göre kimlik bilgilerini (whois) sorgulayabilmelidir", async () => {
		const plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));

		const target = new Player(
			bridge,
			adminManager,
			banManager,
			3,
			"TargetUser",
			"STEAM_0:0:33",
			3,
		);
		playerManager.AddPlayer(target);

		// Add caller player at index 1 to receive replies
		const caller = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Unknown",
			"STEAM_0:0:1",
			1,
		);
		playerManager.AddPlayer(caller);

		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		// Look up by name
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!whois TargetUser",
		});
		expect(lastSay).toBe(
			"Oyuncu: TargetUser | SteamID: STEAM_0:0:33 | Index: 3",
		);

		lastSay = "";

		// Look up by index
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!whois 3",
		});
		expect(lastSay).toBe(
			"Oyuncu: TargetUser | SteamID: STEAM_0:0:33 | Index: 3",
		);

		lastSay = "";

		// Target not found
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!whois InvalidUser",
		});
		expect(lastSay).toBe("(To Unknown) Oyuncu bulunamadı: InvalidUser");
	});

	it("Admin yetkisine göre tek bir oyuncuyu tokatlayabilmeli (slap) veya tüm oyuncuları tokatlayabilmelidir (slapall)", async () => {
		const plugin = new PlayerCommands();
		const context = new PluginContext(
			"PlayerCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));

		const admin = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"AdminGuy",
			"STEAM_0:0:1",
			1,
		);
		const player1 = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"PlayerOne",
			"STEAM_0:0:2",
			2,
		);
		const player2 = new Player(
			bridge,
			adminManager,
			banManager,
			3,
			"PlayerTwo",
			"STEAM_0:0:3",
			3,
		);
		playerManager.AddPlayer(admin);
		playerManager.AddPlayer(player1);
		playerManager.AddPlayer(player2);

		adminManager.SetFlags("STEAM_0:0:1", "c");

		const sentActions: GameAction[] = [];
		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			sentActions.push(action);
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		// Slap PlayerOne
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!slap PlayerOne 15",
		});
		expect(sentActions).toContainEqual({
			action: "slap",
			client: "2",
			damage: "15",
		});
		expect(lastSay).toBe(
			"Admin AdminGuy, PlayerOne oyuncusunu 15 hasar ile tokatladı.",
		);

		// Attempt slapall without 'z' -> Denied
		sentActions.length = 0;
		lastSay = "";
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!slapall 10",
		});
		expect(sentActions.filter((a) => a.action === "slap").length).toBe(0);
		expect(lastSay).toBe("(To AdminGuy) Yetkiniz yok");

		// Upgrade to 'z' and run slapall
		adminManager.SetFlags("STEAM_0:0:1", "z");
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!slapall 10",
		});
		expect(lastSay).toBe("Admin tüm oyuncuları 10 hasar ile tokatladı!");
	});

	it("Yerelleştirilmiş çeviri formatını kullanarak oyuncu istatistiklerini gösterebilmelidir", async () => {
		const plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));
		context.LoadTranslations("CoreCommands");

		const player = new Player(
			bridge,
			adminManager,
			banManager,
			5,
			"StatsUser",
			"STEAM_0:0:5",
			5,
		);
		player.SetTotalStats(25, 10, 5);
		player.SetLanguage("en");
		playerManager.AddPlayer(player);

		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 5,
			text: "!stats",
		});

		expect(lastSay).toBe(
			"(To StatsUser) Player: StatsUser | Kills: 25 | Deaths: 10",
		);
	});

	it("sm_menu gösterimini yönetebilmeli ve seçim yapıldığında ilgili callback fonksiyonunu tetiklemelidir", async () => {
		const plugin = new AdminMenu();
		const context = new PluginContext(
			"AdminMenu",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));

		const admin = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"AdminMenuUser",
			"STEAM_0:0:7",
			7,
		);
		playerManager.AddPlayer(admin);
		adminManager.SetFlags("STEAM_0:0:7", "z");

		let lastSay = "";
		let lastMenuAction: any = null;
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			} else if (action.action === "menu") {
				lastMenuAction = action;
			}
		};

		// Open menu
		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!menu",
		});

		expect(lastMenuAction).toBeDefined();
		expect(lastMenuAction.menu_title).toBe("Admin Menüsü");
		expect(JSON.parse(lastMenuAction.menu_items_json)).toEqual([
			{ info: "kick", display: "Oyuncu At" },
			{ info: "slap", display: "Oyuncuyu Tokatla" },
		]);

		// Simulate selecting 'kick' from the menu
		pluginManager.emit("MenuSelect", {
			client: 1,
			menuId: lastMenuAction.menu_id,
			info: "kick",
		});

		expect(lastSay).toBe("(To AdminMenuUser) Kick seçildi");
	});

	it("Oyuncuya ait tüm olay dinleyicilerini (can, takım, ölüm, silah değişikliği) desteklemelidir", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"EventPlayer",
			"STEAM_0:0:400",
			400,
		);
		playerManager.AddPlayer(player);

		let healthVal = -1;
		let teamVal = -1;
		let weaponVal = "";
		let deathFired = false;

		player.on("HealthChange", (val) => {
			healthVal = val;
		});
		player.on("TeamChange", (val) => {
			teamVal = val;
		});
		player.on("WeaponChange", (val) => {
			weaponVal = val;
		});
		player.on("Death", () => {
			deathFired = true;
		});

		// Trigger state changes
		player.UpdateHealth(85);
		expect(healthVal).toBe(85);
		expect(player.GetHealth()).toBe(85);

		player.UpdateTeam(Team.Terrorist);
		expect(teamVal).toBe(Team.Terrorist);
		expect(player.GetTeam()).toBe(Team.Terrorist);

		player.GiveWeapon("weapon_deagle", { clip: 7, reserve: 35 });
		expect(weaponVal).toBe("weapon_deagle");
		expect(player.GetWeapon()).toBe("weapon_deagle");

		player.UpdateIsAlive(false);
		expect(deathFired).toBe(true);
		expect(player.IsAlive()).toBe(false);
	});

	it("Tüm oyuncu komut eylemlerinin Metamod köprüsüne doğru veri paketleri (payload) göndermesini sağlamalıdır", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			10,
			"ActionPlayer",
			"STEAM_0:0:500",
			500,
		);
		playerManager.AddPlayer(player);

		const sentActions: GameAction[] = [];
		bridge.Send = (action: GameAction) => {
			sentActions.push(action);
		};

		// 1. Say
		player.Say("Test message");
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "(To ActionPlayer) Test message",
		});

		// 2. Kick with reason
		player.Kick("Toxic");
		expect(sentActions.pop()).toEqual({
			action: "kick",
			client: "500",
			reason: "Toxic",
		});

		// 3. Kick without reason
		player.Kick();
		expect(sentActions.pop()).toEqual({
			action: "kick",
			client: "500",
			reason: "Kicked by admin",
		});

		// 4. Slap
		player.Slap(30);
		expect(sentActions.pop()).toEqual({
			action: "slap",
			client: "10",
			damage: "30",
		});

		// 5. Teleport
		player.Teleport(123.4, -567.8, 90.1);
		expect(sentActions.pop()).toEqual({
			action: "teleport",
			client: "10",
			x: "123.4",
			y: "-567.8",
			z: "90.1",
		});

		// 6. SetTeam
		player.SetTeam(Team.CT);
		expect(sentActions.pop()).toEqual({
			action: "set_team",
			client: "10",
			team: "3",
		});

		// 7. Respawn
		player.Respawn();
		expect(sentActions.pop()).toEqual({ action: "respawn", client: "10" });

		// 8. SetGravity
		player.SetGravity(0.5);
		expect(sentActions.pop()).toEqual({
			action: "set_gravity",
			client: "10",
			gravity: "0.5",
		});

		// 9. SetMoveType
		player.SetMoveType(2);
		expect(sentActions.pop()).toEqual({
			action: "set_movetype",
			client: "10",
			movetype: "2",
		});

		// 10. SetHealth
		player.SetHealth(150);
		expect(sentActions.pop()).toEqual({
			action: "set_health",
			client: "10",
			health: "150",
		});

		// 11. SetModel
		player.SetModel("models/player/custom.mdl");
		expect(sentActions.pop()).toEqual({
			action: "set_model",
			client: "10",
			model: "models/player/custom.mdl",
		});

		// 12. SetRenderColor
		player.SetRenderColor(255, 0, 0, 128);
		expect(sentActions.pop()).toEqual({
			action: "set_render_color",
			client: "10",
			r: "255",
			g: "0",
			b: "0",
			a: "128",
		});

		// 13. EmitSound
		player.EmitSound("ambient/alarms/alarm1.wav");
		expect(sentActions.pop()).toEqual({
			action: "play_sound",
			client: "10",
			sound: "ambient/alarms/alarm1.wav",
			all: "false",
		});
	});

	it("PluginContext entegrasyonu kapsamındaki tüm özellikleri (aksiyonlar, izinler, mesajlar, istemci bilgileri) desteklemelidir", async () => {
		// Write translations first
		writeFileSync(
			join(translationsDir, "tr.json"),
			JSON.stringify({
				stats_info: "Oyuncu: {0} | Leş: {1} | Ölüm: {2}",
			}),
		);

		const plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
		await pluginContextStore.run(context, () => plugin.OnLoad(context));
		context.LoadTranslations("CoreCommands");

		const englishPlayer = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"EnglishUser",
			"STEAM_0:0:11",
			11,
		);
		englishPlayer.SetLanguage("en");
		englishPlayer.UpdateHealth(100);
		englishPlayer.UpdateMoney(8000);
		englishPlayer.UpdateTeam(Team.CT);
		playerManager.AddPlayer(englishPlayer);

		const turkishPlayer = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"TurkishUser",
			"STEAM_0:0:22",
			22,
		);
		turkishPlayer.SetLanguage("tr");
		turkishPlayer.UpdateHealth(90);
		turkishPlayer.UpdateMoney(16000);
		turkishPlayer.UpdateTeam(Team.Terrorist);
		turkishPlayer.GiveWeapon("weapon_ak47");
		playerManager.AddPlayer(turkishPlayer);

		adminManager.SetFlags("STEAM_0:0:11", "bc"); // Admin access for EnglishUser

		const sentActions: GameAction[] = [];
		bridge.Send = (action: GameAction) => {
			sentActions.push(action);
		};

		// A. Messaging test
		context.PrintToChat(1, "Hello English");
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "(To EnglishUser) Hello English",
		});

		context.PrintToChat(0, "Broadcast message");
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "Broadcast message",
		});

		context.PrintToChatAll("Broadcast 2");
		expect(sentActions.pop()).toEqual({ action: "say", text: "Broadcast 2" });

		context.ReplyToCommand(1, "Replying");
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "(To EnglishUser) Replying",
		});

		// B. Translation formatting
		context.TPrintToChat(1, "stats_info", "EnglishUser", 5, 2);
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "(To EnglishUser) Player: EnglishUser | Kills: 5 | Deaths: 2",
		});

		context.TPrintToChat(2, "stats_info", "TurkishUser", 8, 4);
		expect(sentActions.pop()).toEqual({
			action: "say",
			text: "(To TurkishUser) Oyuncu: TurkishUser | Leş: 8 | Ölüm: 4",
		});

		// C. Client Info & Stats methods
		expect(context.GetMaxClients()).toBe(32);
		expect(context.GetClientCount()).toBe(2);
		expect(context.GetClientName(1)).toBe("EnglishUser");
		expect(context.GetClientName(99)).toBe("Unknown");
		expect(context.GetClientAuthId(2)).toBe("STEAM_0:0:22");
		expect(context.GetClientAuthId(99)).toBe("ID_PENDING");
		expect(context.GetClientUserId(1)).toBe(11);
		expect(context.GetClientUserId(99)).toBe(0);
		expect(context.GetClientHealth(2)).toBe(90);
		expect(context.GetClientMoney(1)).toBe(8000);
		expect(context.GetClientTeam(2)).toBe(Team.Terrorist);
		expect(context.IsClientInGame(2)).toBe(true);
		expect(context.IsClientInGame(99)).toBe(false);
		expect(context.IsPlayerAlive(1)).toBe(true);
		expect(context.GetClientWeapon(2)).toBe("weapon_ak47");

		// D. Action Wrapper methods
		context.SlapPlayer(2, 10);
		expect(sentActions.pop()).toEqual({
			action: "slap",
			client: "2",
			damage: "10",
		});

		context.TeleportEntity(1, 10.0, 20.0, 30.0);
		expect(sentActions.pop()).toEqual({
			action: "teleport",
			client: "1",
			x: "10",
			y: "20",
			z: "30",
		});

		context.ChangeClientTeam(1, Team.Terrorist);
		expect(sentActions.pop()).toEqual({
			action: "set_team",
			client: "1",
			team: "2",
		});

		context.RespawnPlayer(2);
		expect(sentActions.pop()).toEqual({ action: "respawn", client: "2" });

		context.GivePlayerItem(2, "weapon_m4a1");
		expect(sentActions.pop()).toEqual({
			action: "give_item",
			client: "2",
			item: "weapon_m4a1",
		});

		context.RemovePlayerItem(2, "weapon_ak47");
		expect(sentActions.pop()).toEqual({
			action: "remove_item",
			client: "2",
			item: "weapon_ak47",
		});

		context.SetWeaponAmmo(2, "weapon_m4a1", 90);
		expect(sentActions.pop()).toEqual({
			action: "set_ammo",
			client: "2",
			weapon: "weapon_m4a1",
			ammo: "90",
		});

		context.SetEntityGravity(1, 0.9);
		expect(sentActions.pop()).toEqual({
			action: "set_gravity",
			client: "1",
			gravity: "0.9",
		});

		context.SetEntityMoveType(1, 4);
		expect(sentActions.pop()).toEqual({
			action: "set_movetype",
			client: "1",
			movetype: "4",
		});

		context.SetEntityHealth(1, 95);
		expect(sentActions.pop()).toEqual({
			action: "set_health",
			client: "1",
			health: "95",
		});

		context.SetEntityModel(1, "models/gign.mdl");
		expect(sentActions.pop()).toEqual({
			action: "set_model",
			client: "1",
			model: "models/gign.mdl",
		});

		context.SetEntityRenderColor(1, 0, 255, 0, 255);
		expect(sentActions.pop()).toEqual({
			action: "set_render_color",
			client: "1",
			r: "0",
			g: "255",
			b: "0",
			a: "255",
		});

		context.EmitSoundToClient(1, "weapons/c4/c4_beep.wav");
		expect(sentActions.pop()).toEqual({
			action: "play_sound",
			client: "1",
			sound: "weapons/c4/c4_beep.wav",
			all: "false",
		});

		context.EmitSoundToAll("weapons/explode3.wav");
		expect(sentActions.pop()).toEqual({
			action: "play_sound",
			sound: "weapons/explode3.wav",
			all: "true",
		});

		context.KickClient(2, "Cheating");
		expect(sentActions.pop()).toEqual({
			action: "kick",
			client: "22",
			reason: "Cheating",
		});

		context.BanClient("STEAM_0:0:666", "Wallhack", "STEAM_0:0:11", 1440);
		expect(sentActions.pop()).toEqual({
			action: "ban",
			steamid: "STEAM_0:0:666",
			duration: "1440",
			reason: "Wallhack",
		});

		context.RemoveBan("STEAM_0:0:666");
		expect(sentActions.pop()).toEqual({
			action: "unban",
			steamid: "STEAM_0:0:666",
		});

		// E. Permission methods
		expect(context.CheckCommandAccess(1, "sm_kick", "c")).toBe(true);
		expect(context.CheckCommandAccess(1, "sm_kick", "z")).toBe(false);
		expect(context.CheckCommandAccess(2, "sm_kick", "c")).toBe(false);
		expect(context.GetUserFlagBits(1)).toBe("bc");
		expect(context.GetUserFlagBits(2)).toBe("");
	});

	it("SQL tabanlı ban kontrollerini uygulayarak yasaklı oyuncuların bağlantısını reddetmelidir", async () => {
		const steamId = "STEAM_0:0:999";
		const normalSteamId = "STEAM_0:0:777";

		// 1. Initial State: players are not banned
		expect(await banManager.CheckBan(steamId)).toBe(false);
		expect(await banManager.CheckBan(normalSteamId)).toBe(false);

		// 2. Add ban via banManager
		await banManager.BanClient(
			steamId,
			"Abusive behavior",
			"STEAM_0:0:100",
			60,
		); // 60 mins
		expect(await banManager.CheckBan(steamId)).toBe(true);
		expect(await banManager.CheckBan(normalSteamId)).toBe(false);

		// 3. Connect players to PlayerManager and check connection flow
		const normalPlayer = new Player(
			bridge,
			adminManager,
			banManager,
			10,
			"FriendlyUser",
			normalSteamId,
			10,
		);
		const toxicPlayer = new Player(
			bridge,
			adminManager,
			banManager,
			11,
			"ToxicUser",
			steamId,
			11,
		);

		expect(await normalPlayer.IsBanned()).toBe(false);
		expect(await toxicPlayer.IsBanned()).toBe(true);

		// 4. Remove ban and confirm connection is allowed
		await banManager.RemoveBan(steamId);
		expect(await banManager.CheckBan(steamId)).toBe(false);
		expect(await toxicPlayer.IsBanned()).toBe(false);
	});

	it("Oyuncunun mute, gag ve silence durumlarını takip edebilmeli ve gag durumunda mesaj göndermesini engellemelidir", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"MutedPlayer",
			"STEAM_0:0:600",
			600,
		);
		playerManager.AddPlayer(player);

		expect(player.IsMuted()).toBe(false);
		expect(player.IsGagged()).toBe(false);

		// Mute/Gag state
		player.Gag();
		expect(player.IsGagged()).toBe(true);

		player.Mute();
		expect(player.IsMuted()).toBe(true);

		// Silence
		player.Unsilence();
		expect(player.IsMuted()).toBe(false);
		expect(player.IsGagged()).toBe(false);

		player.Silence();
		expect(player.IsMuted()).toBe(true);
		expect(player.IsGagged()).toBe(true);

		// Test command interceptor blocks chat
		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		pluginManager.emit("PlayerChat", {
			event: "PlayerChat",
			client: 1,
			text: "!ping",
		});

		expect(lastSay).toBe(
			"(To MutedPlayer) You cannot send messages while your chat is gagged.",
		);
	});

	it("Adminler arası hedef alma işlemlerinde bağışıklık derecelerini (immunity) doğrulamalıdır", () => {
		// Root Admin (imm=99), Normal Admin (imm=50), Normal Player (imm=0)
		adminManager.SetImmunity("STEAM_ROOT", 99);
		adminManager.SetImmunity("STEAM_VIP", 50);

		const rootAdmin = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Root",
			"STEAM_ROOT",
			101,
		);
		const vipAdmin = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"VIP",
			"STEAM_VIP",
			102,
		);
		const regularPlayer = new Player(
			bridge,
			adminManager,
			banManager,
			3,
			"Player",
			"STEAM_PLAYER",
			103,
		);

		playerManager.AddPlayer(rootAdmin);
		playerManager.AddPlayer(vipAdmin);
		playerManager.AddPlayer(regularPlayer);

		expect(rootAdmin.GetImmunity()).toBe(99);
		expect(vipAdmin.GetImmunity()).toBe(50);
		expect(regularPlayer.GetImmunity()).toBe(0);

		// Root target checks
		expect(rootAdmin.CanTarget(vipAdmin)).toBe(true);
		expect(rootAdmin.CanTarget(regularPlayer)).toBe(true);

		// VIP target checks
		expect(vipAdmin.CanTarget(regularPlayer)).toBe(true);
		expect(vipAdmin.CanTarget(rootAdmin)).toBe(false); // VIP cannot target Root

		// Player target checks
		expect(regularPlayer.CanTarget(vipAdmin)).toBe(false);
	});

	it("Kafadan vuruş, hasar ve MVP gibi gelişmiş istatistiklerin takibini ve kaydedilmesini desteklemelidir", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"StatsPro",
			"STEAM_STATS",
			700,
		);
		playerManager.AddPlayer(player);

		player.AddHeadshot();
		player.AddDamage(350);
		player.AddMVP();

		expect(player.GetHeadshots()).toBe(1);
		expect(player.GetDamage()).toBe(350);
		expect(player.GetMVPs()).toBe(1);
		expect(player.GetPlaytime()).toBeGreaterThanOrEqual(0);

		// Checkpoint
		playerManager.Checkpoint();

		const data = db.GetPlayer("STEAM_STATS");
		expect(data?.total_headshots).toBe(1);
		expect(data?.total_damage).toBe(350);
		expect(data?.total_mvps).toBe(1);
	});

	it("AFK kalan oyuncuları tespit edip otomatik olarak spec (izleyici) takımına taşımalıdır", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"AFKPlayer",
			"STEAM_AFK",
			800,
		);
		player.UpdateTeam(Team.Terrorist);
		playerManager.AddPlayer(player);

		// Initial state: not idle
		expect(player.GetIdleTime()).toBe(0);

		// Simulate idle time by altering lastActiveTime manually for testing
		(player as any)._lastActiveTime = Date.now() - 10000; // 10 seconds ago
		expect(player.GetIdleTime()).toBeGreaterThanOrEqual(10);

		// Check AFK -> Spec
		let lastSay = "";
		const sentActions: GameAction[] = [];
		bridge.Send = (action: GameAction) => {
			sentActions.push(action);
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};
		playerManager.CheckAFKPlayers(5, "spec");
		expect(sentActions).toContainEqual({
			action: "set_team",
			client: "1",
			team: "1",
		});
		expect(lastSay).toBe(
			"(To AFKPlayer) You have been moved to spectator for being AFK.",
		);

		// Simulate engine loopback response updating the team
		player.UpdateTeam(Team.Spectator);
		expect(player.GetTeam()).toBe(Team.Spectator);
	});

	it("VIP slot hakkını doğrulamalı ve sunucu doluyken normal oyuncuyu atarak VIP girişine izin vermelidir", () => {
		// Connect max players to fill server (e.g. maxClients = 2)
		const p1 = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Normal1",
			"STEAM_P1",
			901,
		);
		const p2 = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"Normal2",
			"STEAM_P2",
			902,
		);
		playerManager.AddPlayer(p1);
		playerManager.AddPlayer(p2);

		// VIP player tries to connect
		const res = playerManager.CheckReservation("STEAM_VIP_CONN", "a", 2);
		expect(res.allowed).toBe(true);
		expect(res.kickIndex).toBeDefined(); // Kicks someone to make room

		// Non-VIP tries to connect -> Denied
		const resDenied = playerManager.CheckReservation("STEAM_NORM_CONN", "", 2);
		expect(resDenied.allowed).toBe(false);
	});

	it("Renkli sohbet biçimlendirmesinde PascalCase formatındaki renk etiketlerini Source kodlarına dönüştürmelidir", () => {
		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		const _plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);

		context.PrintToChatAll("{Green}Hello {Red}World{Default}");
		expect(lastSay).toBe("\x04Hello \x02World\x01");

		context.PrintToChat(0, "{Blue}Team {Yellow}Win{Default}");
		expect(lastSay).toBe("\x0BTeam \x09Win\x01");
	});

	it("Callback fonksiyonları yardımıyla oylama sistemini başlatmayı ve oy dağılımını toplamayı desteklemelidir", async () => {
		const _plugin = new VoteCommands();
		const context = new PluginContext(
			"VoteCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);

		const p1 = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"PlayerOne",
			"STEAM_P1",
			901,
		);
		const p2 = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"PlayerTwo",
			"STEAM_P2",
			902,
		);
		playerManager.AddPlayer(p1);
		playerManager.AddPlayer(p2);

		let lastMenuId = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "menu") {
				lastMenuId = (action as any).menu_id || "";
			}
		};

		const votePromise = new Promise<Record<string, number>>((resolve) => {
			context.CreateVote(
				"Gelecek harita ne olsun?",
				["de_dust2", "de_inferno"],
				(results) => {
					resolve(results);
				},
				50,
			); // 50ms vote duration
		});

		// Simulate voting
		pluginManager.emit("MenuSelect", {
			client: 1,
			menuId: lastMenuId,
			info: "de_dust2",
		});
		pluginManager.emit("MenuSelect", {
			client: 2,
			menuId: lastMenuId,
			info: "de_inferno",
		});

		const results = await votePromise;
		expect(results.de_dust2).toBe(1);
		expect(results.de_inferno).toBe(1);
	});

	it("IP adresine göre GeoIP ülke sorgusunu, gelişmiş dosya loglayıcısını ve motor metriklerini desteklemelidir", () => {
		const _plugin = new CoreCommands();
		const context = new PluginContext(
			"CoreCommands",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);

		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"TurkishPro",
			"STEAM_GEO",
			950,
		);
		player.SetIPAddress("1.1.2.3");
		playerManager.AddPlayer(player);

		// 1. GeoIP checks
		expect(context.GetClientIP(1)).toBe("1.1.2.3");
		expect(context.GetClientCountry(1)).toBe("Turkey");

		// 2. Logging to File
		const logFile = "test_run.log";
		const fs = require("node:fs");
		const path = require("node:path");
		const logFilePath = path.join(process.cwd(), "logs", logFile);
		if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);

		context.LogToFile(logFile, "Admin slapped player TurkishPro");
		expect(fs.existsSync(logFilePath)).toBe(true);
		const content = fs.readFileSync(logFilePath, "utf8");
		expect(content).toContain("Admin slapped player TurkishPro");
		fs.unlinkSync(logFilePath);

		// 3. Engine Metrics
		expect(context.GetEngineTime()).toBeGreaterThan(0);
		expect(context.GetTickrate()).toBe(128);
		expect(context.GetTickInterval()).toBe(1 / 128);
		expect(context.GetBridgeLatency()).toBe(5);
	});
});
