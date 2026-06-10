import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { BanManager } from "../../src/ts/admins/bans";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { DatabaseManager } from "../../src/ts/shared/database";
import type { GameAction } from "../../src/ts/shared/types/bridge";
import { Team } from "../../src/ts/shared/types/enums";
import {
	startIntegrationServer,
	stopIntegrationServer,
} from "../helpers/integration-setup";

describe("Köprü ve Oyuncu Ağ İletişimi Entegrasyon Testleri", () => {
	const dbPath = "./test_meta_bun.db";
	let db: DatabaseManager;
	let banManager: BanManager;
	let bridge: Bridge;
	let playerManager: PlayerManager;
	let adminManager: AdminManager;

	beforeAll(async () => {
		await startIntegrationServer();
		db = new DatabaseManager(dbPath);
		banManager = new BanManager(db);
		bridge = new Bridge();
		playerManager = new PlayerManager(db, false);
		adminManager = new AdminManager();
	});

	afterAll(() => {
		stopIntegrationServer();
		db.close();
	});

	it("Metamod köprüsü ile soket bağlantısı kurabilmeli ve komut/sohbet eylemlerini TCP üzerinden gönderebilmelidir", async () => {
		// Connect using Bun.connect to mock server
		const socket = await Bun.connect({
			hostname: "127.0.0.1",
			port: 9000,
			socket: {
				data(_socket, _data) {},
				open(_socket) {},
				close(_socket) {},
				error(_socket, _err) {},
			},
		});

		bridge.SetSocket(socket as any);

		let lastSay = "";
		let lastAction: any = null;

		bridge.Send = (action: GameAction) => {
			lastAction = action;
			if (action.action === "say") {
				lastSay = action.text || "";
			}
		};

		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"Alice",
			"STEAM_A",
			101,
		);
		player.Say("hello tcp");
		expect(lastSay).toBe("(To Alice) hello tcp");

		player.Kick("spam");
		expect(lastAction).toEqual({
			action: "kick_client",
			userid: 101,
			reason: "spam",
		});

		socket.end();
		bridge.SetSocket(null);
	});

	it("PlayerManager bünyesindeki oyuncuları takımlarına ve hayatta olma durumlarına göre doğru filtreleyebilmelidir", () => {
		const p1 = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"T_Alive",
			"STEAM_T",
			101,
		);
		p1.UpdateTeam(Team.Terrorist);
		p1.UpdateIsAlive(true);

		const p2 = new Player(
			bridge,
			adminManager,
			banManager,
			2,
			"CT_Alive",
			"STEAM_CT",
			102,
		);
		p2.UpdateTeam(Team.CT);
		p2.UpdateIsAlive(true);

		const p3 = new Player(
			bridge,
			adminManager,
			banManager,
			3,
			"CT_Dead",
			"STEAM_CT_D",
			103,
		);
		p3.UpdateTeam(Team.CT);
		p3.UpdateIsAlive(false);

		playerManager.AddPlayer(p1);
		playerManager.AddPlayer(p2);
		playerManager.AddPlayer(p3);

		// Team filtering
		const cts = playerManager.GetClientsByTeam(Team.CT);
		expect(cts.length).toBe(2);
		expect(cts.map((c) => c.name)).toContain("CT_Alive");
		expect(cts.map((c) => c.name)).toContain("CT_Dead");

		// Alive filtering
		const alive = playerManager.GetAliveClients();
		expect(alive.length).toBe(2);
		expect(alive.map((c) => c.name)).toContain("T_Alive");
		expect(alive.map((c) => c.name)).toContain("CT_Alive");

		// Clear
		playerManager.RemovePlayer(1);
		playerManager.RemovePlayer(2);
		playerManager.RemovePlayer(3);
	});
});
