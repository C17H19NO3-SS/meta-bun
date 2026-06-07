import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import MapChooser from "../../plugins/map-chooser/index";
import { BanManager } from "../../src/ts/admins/bans";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { pluginContextStore } from "../../src/ts/shared/context-store";
import { DatabaseManager } from "../../src/ts/shared/database";
import { SDKHookType } from "../../src/ts/shared/types/bridge";
import { Plugin_Handled } from "../../src/ts/shared/types/enums";

describe("Yeni Entegre Edilen SourceMod Özellikleri Test Grubu", () => {
	const dbPath = "./test_meta_bun.db";
	let db: DatabaseManager;
	let banManager: BanManager;
	let bridge: Bridge;
	let playerManager: PlayerManager;
	let adminManager: AdminManager;
	let pluginManager: PluginManager;
	let context: PluginContext;

	beforeEach(() => {
		db = new DatabaseManager(dbPath);
		db.clearAll();
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
			"TestSMFeatures",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);
	});

	afterEach(() => {
		context.Cleanup();
		pluginManager.Stop();
		db.close();
	});

	it("1. ConVar API -> ConVar oluşturabilmeli, güncelleyebilmeli ve change hook tetikleyebilmelidir", () => {
		pluginContextStore.run(context, () => {
			const cvar = context.CreateConVar("sm_test_cvar", "1.5", "Test ConVar");
			expect(cvar).toBeDefined();
			expect(cvar.GetName()).toBe("sm_test_cvar");
			expect(cvar.GetFloat()).toBe(1.5);
			expect(cvar.GetInt()).toBe(1);
			expect(cvar.GetString()).toBe("1.5");

			const found = context.FindConVar("sm_test_cvar");
			expect(found).toBeDefined();
			expect(found?.GetName()).toBe("sm_test_cvar");

			let hookCalled = false;
			let oldVal = "";
			let newVal = "";
			cvar.AddChangeHook((_cv, oldV, newV) => {
				hookCalled = true;
				oldVal = oldV;
				newVal = newV;
			});

			cvar.SetFloat(2.5);
			expect(hookCalled).toBe(true);
			expect(oldVal).toBe("1.5");
			expect(newVal).toBe("2.5");
			expect(cvar.GetFloat()).toBe(2.5);
		});
	});

	it("2. ClientPrefs Cookie API -> Cookie tanımlayabilmeli, set/get işlemlerini DB persist ile yapabilmelidir", () => {
		pluginContextStore.run(context, () => {
			const cookie = context.RegClientCookie(
				"test_pref",
				"Test Cookie preference",
			);
			expect(cookie).toBeDefined();
			expect(cookie.GetName()).toBe("test_pref");

			const found = context.FindClientCookie("test_pref");
			expect(found).toBeDefined();

			const player = new Player(
				bridge,
				adminManager,
				banManager,
				1,
				"CookieUser",
				"STEAM_0:0:555",
				15,
			);
			playerManager.AddPlayer(player);

			cookie.Set(1, "dark-mode");
			expect(cookie.Get(1)).toBe("dark-mode");

			// Verify it is persisted in the sqlite DB
			const dbValue = (db as any).GetCookie("STEAM_0:0:555", "test_pref");
			expect(dbValue).toBe("dark-mode");
		});
	});

	it("3. SQL_TQuery API -> Asenkron veritabanı sorgusu yapabilmelidir", async () => {
		// Insert dummy data directly
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"SqlUser",
			"STEAM_0:0:777",
			20,
		);
		player.SetTotalStats(10, 2, 5);
		playerManager.AddPlayer(player);
		playerManager.Checkpoint(); // Flushes to DB

		await pluginContextStore.run(context, async () => {
			const rows = await context.SQL_TQuery(
				"SELECT * FROM players WHERE steamid = ?",
				["STEAM_0:0:777"],
			);
			expect(rows).toBeDefined();
			expect(rows.length).toBe(1);
			expect(rows[0].last_name).toBe("SqlUser");
			expect(rows[0].total_kills).toBe(10);
		});
	});

	it("4. HookEventPre API -> Olayları gerçekleşmeden önce engelleyebilmelidir", () => {
		pluginContextStore.run(context, () => {
			let preHookCalled = false;
			let postHookCalled = false;

			// Register a pre hook that returns Plugin_Handled (to block the event)
			context.HookEventPre("PlayerSpawned", (_data) => {
				preHookCalled = true;
				return Plugin_Handled;
			});

			// Register standard post hook
			pluginManager.on("PlayerSpawned", (_data) => {
				postHookCalled = true;
			});

			// Emit the event via pluginManager
			const eventHandled = pluginManager.emit("PlayerSpawned", {
				client: 1,
				team: 2,
			});

			expect(preHookCalled).toBe(true);
			expect(postHookCalled).toBe(false); // Should have been blocked
			expect(eventHandled).toBe(false); // Emit should return false since it was blocked
		});
	});

	it("5. SDKHook API -> Düşük seviye SDK kancalarını çalıştırabilmelidir", () => {
		pluginContextStore.run(context, () => {
			let sdkHookCalled = false;
			let damageAmount = 0;

			context.SDKHook(
				1,
				SDKHookType.OnTakeDamage,
				(_victim, _attacker, damage) => {
					sdkHookCalled = true;
					damageAmount = damage;
					return Plugin_Handled;
				},
			);

			// Trigger SDKHook call in PluginManager
			const sdkMap = (pluginManager as any).sdkHooks.get(1);
			expect(sdkMap).toBeDefined();
			const callbacks = sdkMap.get(SDKHookType.OnTakeDamage);
			expect(callbacks).toBeDefined();
			expect(callbacks.length).toBe(1);

			const result = callbacks[0](1, 2, 50.0);
			expect(sdkHookCalled).toBe(true);
			expect(damageAmount).toBe(50.0);
			expect(result).toBe(Plugin_Handled);
		});
	});

	it("6. MapChooser Plugin -> RTV ve Nominate oylaması akışını simüle edebilmelidir", async () => {
		const plugin = new MapChooser();
		const mapChooserContext = new PluginContext(
			"MapChooser",
			pluginManager,
			bridge,
			playerManager,
			adminManager,
			{
				RegConsoleCmd: pluginManager.RegConsoleCmd.bind(pluginManager),
				UnregConsoleCmd: pluginManager.UnregConsoleCmd.bind(pluginManager),
			},
		);

		// Mock players
		const p1 = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"User1",
			"STEAM_0:0:1",
			5,
		);
		const p2 = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"User2",
			"STEAM_0:0:2",
			6,
		);
		playerManager.AddPlayer(p1);
		playerManager.AddPlayer(p2);

		await pluginContextStore.run(mapChooserContext, async () => {
			await plugin.OnLoad(mapChooserContext);

			let voteTriggered = false;
			mapChooserContext.CreateVote = (
				_question,
				_options,
				callback,
				_duration,
			) => {
				voteTriggered = true;
				// Immediate finish vote with winning map
				callback({ de_dust2: 2 });
			};

			// Trigger RTV command for player 1
			pluginManager.emit("PlayerChat", {
				event: "PlayerChat",
				client: 1,
				text: "!rtv",
			});
			// RTV needs 60% of players, 2 players total -> 1 is 50%, needs 2
			expect(voteTriggered).toBe(false);

			// Trigger RTV for player 2
			pluginManager.emit("PlayerChat", {
				event: "PlayerChat",
				client: 2,
				text: "!rtv",
			});
			expect(voteTriggered).toBe(true);

			await plugin.OnUnload();
		});
	});

	it("7. İzleyici, Bayrak ve Hız API'leri -> IsObserver, GetObserverTarget, GetEntityFlags ve Hız değerleri doğru şekilde işlenmelidir", () => {
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Speedy",
			"STEAM_0:0:888",
			88,
		);
		playerManager.AddPlayer(player);

		expect(player.IsObserver()).toBe(false);
		expect(player.GetObserverTarget()).toBe(0);
		expect(player.GetEntityFlags()).toBe(0);
		expect(player.GetVelocity()).toEqual({ x: 0, y: 0, z: 0 });

		// Manually trigger updates to player object
		player.UpdateObserverState(true, 2);
		player.UpdateEntityFlags(257);
		player.UpdateVelocity(150, -50, 10);

		expect(player.IsObserver()).toBe(true);
		expect(player.GetObserverTarget()).toBe(2);
		expect(player.GetEntityFlags()).toBe(257);
		expect(player.GetVelocity()).toEqual({ x: 150, y: -50, z: 10 });

		// Set velocity command send check
		let lastAction: any = null;
		bridge.Send = (action) => {
			lastAction = action;
		};

		player.SetVelocity(100, 200, 300);
		expect(lastAction).toEqual({
			action: "set_velocity",
			client: "1",
			x: "100",
			y: "200",
			z: "300",
		});
	});

	it("8. Oylama İptali (CancelVote) -> Aktif oylamayı iptal edebilmeli ve state temizlemelidir", () => {
		// Add at least one in-game client to avoid early return on CreateVote
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Voter",
			"STEAM_0:0:999",
			99,
		);
		playerManager.AddPlayer(player);

		let voteCompleted = false;

		pluginContextStore.run(context, () => {
			context.CreateVote(
				"Oylama Soru",
				["A", "B"],
				(_results) => {
					voteCompleted = true;
				},
				5000,
			);

			// Verify vote is active
			expect((pluginManager as any).activeVote).toBe(true);

			// Cancel vote
			const res = context.CancelVote();
			expect(res).toBe(true);
			expect((pluginManager as any).activeVote).toBe(false);

			// Vote callback should not have executed automatically
			expect(voteCompleted).toBe(false);
		});
	});

	it("9. SDKUnhook ve Köprü Bildirimleri -> SDK kancasını kaldırabilmeli ve C++ köprüsüne hook/unhook sinyallerini iletebilmelidir", () => {
		const sentActions: any[] = [];
		bridge.Send = (action) => {
			sentActions.push(action);
		};

		pluginContextStore.run(context, () => {
			const callback = (
				_victim: number,
				_attacker: number,
				_damage: number,
			) => {
				return 0;
			};

			// Hook
			context.SDKHook(1, SDKHookType.OnTakeDamage, callback);
			expect(sentActions).toContainEqual({
				action: "hook_sdk",
				client: 1,
				type: SDKHookType.OnTakeDamage,
			});

			// Unhook
			context.SDKUnhook(1, SDKHookType.OnTakeDamage, callback);
			expect(sentActions).toContainEqual({
				action: "unhook_sdk",
				client: 1,
				type: SDKHookType.OnTakeDamage,
			});
		});
	});

	it("10. ConVar Değişiklik Kancaları (Change Hooks) ve Köprü Senkronizasyonu", () => {
		const sentActions: any[] = [];
		bridge.Send = (action) => {
			sentActions.push(action);
		};

		pluginContextStore.run(context, () => {
			// Create ConVar
			const cvar = context.CreateConVar(
				"sm_test_cvar",
				"10",
				"Test Description",
			);
			expect(sentActions).toContainEqual({
				action: "cvar_register",
				name: "sm_test_cvar",
				defaultValue: "10",
				description: "Test Description",
			});

			// Hook change
			let hookCalled = false;
			let hookOldVal = "";
			let hookNewVal = "";
			cvar.AddChangeHook((_cv, oldVal, newVal) => {
				hookCalled = true;
				hookOldVal = oldVal;
				hookNewVal = newVal;
			});

			// Set value from JS
			cvar.SetInt(25);
			expect(cvar.GetInt()).toBe(25);
			expect(sentActions).toContainEqual({
				action: "cvar_set",
				name: "sm_test_cvar",
				value: "25",
			});
			expect(hookCalled).toBe(true);
			expect(hookOldVal).toBe("10");
			expect(hookNewVal).toBe("25");

			// Reset hook state
			hookCalled = false;

			// Simulate ConVarChanged event from bridge (C++ changed cvar)
			pluginManager.emit("ConVarChanged", {
				event: "ConVarChanged",
				name: "sm_test_cvar",
				value: "50",
			});
			expect(cvar.GetInt()).toBe(50);
			expect(hookCalled).toBe(true);
			expect(hookOldVal).toBe("25");
			expect(hookNewVal).toBe("50");
		});
	});
});
