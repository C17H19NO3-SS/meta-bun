import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BanManager } from "../../src/ts/admins/bans";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { MessagePipeline } from "../../src/ts/plugin-system/pipeline";
import { DatabaseManager } from "../../src/ts/shared/database";
import { translationManager } from "../../src/ts/shared/translations";
import type { GameAction } from "../../src/ts/shared/types/bridge";

describe("Eklenti Bağlamı (PluginContext) Birim Testleri", () => {
	const dbPath = "./test_meta_bun.db";
	const transDir = `./test_ctx_translations_${Date.now()}`;
	let db: DatabaseManager;
	let banManager: BanManager;
	let bridge: Bridge;
	let playerManager: PlayerManager;
	let adminManager: AdminManager;
	let pluginManager: PluginManager;
	let context: PluginContext;

	beforeAll(() => {
		mkdirSync(transDir, { recursive: true });
		writeFileSync(
			join(transDir, "en.json"),
			JSON.stringify({
				welcome: "Welcome {0} to the server!",
			}),
		);
		writeFileSync(
			join(transDir, "tr.json"),
			JSON.stringify({
				welcome: "Sunucuya hoş geldin {0}!",
			}),
		);
		(translationManager as any).baseDir = transDir;

		db = new DatabaseManager(dbPath);
		banManager = new BanManager(db);
		bridge = new Bridge();
		playerManager = new PlayerManager(db, false);
		adminManager = new AdminManager();
		pluginManager = new PluginManager(
			bridge,
			playerManager,
			adminManager,
			false,
		);

		context = new PluginContext(
			"TestPlugin",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
			new MessagePipeline(),
		);
		context.LoadTranslations("TestPlugin");
	});

	afterAll(() => {
		db.close();
		rmSync(transDir, { recursive: true, force: true });
	});

	it("Mesajlardaki renk etiketlerini Source motorunun renk karakter kodlarına dönüştürerek düzgün biçimde yazdırmalıdır", () => {
		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		context.PrintToChatAll("{Green}Hello {Red}World{Default}");
		expect(lastSay).toBe("\x04Hello \x02World\x01");

		context.PrintToChat(0, "{Blue}Team{Default}");
		expect(lastSay).toBe("\x0BTeam\x01");
	});

	it("Çeviri dosyalarını yükleyip oyuncunun dil seçeneğine göre yerelleştirilmiş mesajlar döndürmelidir", () => {
		const playerEn = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Alice",
			"STEAM_A",
			101,
		);
		playerEn.SetLanguage("en");
		playerManager.AddPlayer(playerEn);

		const playerTr = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"Ahmet",
			"STEAM_B",
			102,
		);
		playerTr.SetLanguage("tr");
		playerManager.AddPlayer(playerTr);

		let lastSay = "";
		bridge.Send = (action: GameAction) => {
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		context.TPrintToChat(1, "welcome", "Alice");
		expect(lastSay).toBe("(To Alice) Welcome Alice to the server!");

		context.TPrintToChat(2, "welcome", "Ahmet");
		expect(lastSay).toBe("(To Ahmet) Sunucuya hoş geldin Ahmet!");
	});

	it("Bağlı istemci sayısını ve istemci özniteliklerini (isim, SteamID, UserID vb.) doğru şekilde sorgulayabilmelidir", () => {
		expect(context.GetMaxClients()).toBe(32);
		expect(context.GetClientCount()).toBe(2);
		expect(context.GetClientName(1)).toBe("Alice");
		expect(context.GetClientAuthId(2)).toBe("STEAM_B");
		expect(context.GetClientUserId(1)).toBe(101);
		expect(context.IsClientInGame(2)).toBe(true);
		expect(context.IsClientInGame(99)).toBe(false);
	});

	it("Admin yöneticisi yetki bayraklarını baz alarak komut erişim yetkilerini kontrol edebilmelidir", () => {
		adminManager.SetFlags("STEAM_A", "c");
		expect(context.CheckCommandAccess(1, "sm_kick", "c")).toBe(true);
		expect(context.CheckCommandAccess(1, "sm_kick", "z")).toBe(false);
		expect(context.CheckCommandAccess(2, "sm_kick", "c")).toBe(false);
	});

	it("Gelişmiş dosya loglayıcısını (file logger) ve oyun motoru metriklerini desteklemelidir", () => {
		const logFile = "ctx_test.log";
		const fs = require("node:fs");
		const path = require("node:path");
		const logFilePath = path.join(process.cwd(), "logs", logFile);
		if (fs.existsSync(logFilePath)) fs.unlinkSync(logFilePath);

		context.LogToFile(logFile, "Slapped player");
		expect(fs.existsSync(logFilePath)).toBe(true);
		const content = fs.readFileSync(logFilePath, "utf8");
		expect(content).toContain("Slapped player");
		fs.unlinkSync(logFilePath);

		expect(context.GetEngineTime()).toBeGreaterThan(0);
		expect(context.GetTickrate()).toBe(128);
		expect(context.GetTickInterval()).toBe(1 / 128);
		expect(context.GetBridgeLatency()).toBe(5);
	});

	it("Olay dinleyicilerini (event hooks) dinamik olarak kaydedebilmeli ve eklenti kaldırıldığında bunları temizleyebilmelidir", async () => {
		let lastAction: any = null;
		bridge.Send = (action: GameAction) => {
			lastAction = action;
		};

		const eventCallback = () => {};
		context.HookEvent("PlayerSpawned", eventCallback);
		expect(lastAction).toEqual({
			action: "hook_event",
			event: "PlayerSpawned",
		});

		// Clean up context to trigger unregistering
		context.Cleanup();

		// Wait for the removeListener setTimeout tick
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(lastAction).toEqual({
			action: "unhook_event",
			event: "PlayerSpawned",
		});
	});
});
