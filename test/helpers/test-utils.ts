import { BanManager } from "../src/ts/admins/bans";
import { AdminManager } from "../src/ts/admins/manager";
import { Bridge } from "../src/ts/network/bridge";
import { PlayerManager } from "../src/ts/players/manager";
import { DatabaseManager } from "../src/ts/shared/database";

// Create a simple DatabaseManager mock
class MockDatabaseManager extends DatabaseManager {
	constructor() {
		super("");
	}
	GetBan(_steamid: string) {
		return null;
	}
	AddBan(_ban: any) {}
	RemoveBan(_steamid: string) {}
}

export function createTestUtils() {
	const bridge = new Bridge();
	(bridge as any).sent = [];
	bridge.Send = (data: any) => (bridge as any).sent.push(data);

	const db = new MockDatabaseManager();
	const adminManager = new AdminManager();
	const banManager = new BanManager(db);
	const playerManager = new PlayerManager();

	return { bridge, adminManager, banManager, playerManager };
}

export function createRealTestUtils(dbPath: string) {
	const bridge = new Bridge();
	(bridge as any).sent = [];
	bridge.Send = (data: any) => (bridge as any).sent.push(data);

	const db = new DatabaseManager(dbPath);
	const adminManager = new AdminManager();
	const banManager = new BanManager(db);
	const playerManager = new PlayerManager();

	return { bridge, adminManager, banManager, playerManager, db };
}
