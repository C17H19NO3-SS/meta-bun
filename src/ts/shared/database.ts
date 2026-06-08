import { Database } from "bun:sqlite";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Interface representing player data persisted in the database.
 */
export interface IPlayerData {
	steamid: string;
	last_name: string;
	total_kills: number;
	total_deaths: number;
	total_assists: number;
	total_headshots?: number;
	total_damage?: number;
	total_mvps?: number;
	total_playtime?: number;
	is_muted?: number;
	is_gagged?: number;
}

/**
 * Interface representing ban data persisted in the database.
 */
export interface IBanData {
	steamid: string;
	reason: string;
	admin_steamid: string;
	duration: number;
	timestamp: number;
	ip?: string;
}

/**
 * Handles SQLite database connection, initialization, and CRUD operations for players and bans.
 */
export class DatabaseManager {
	private db: Database;
	private driver: string = "sqlite";
	private dbPath: string;

	/**
	 * Initializes the database connection and creates tables if they do not exist.
	 *
	 * @param path The SQLite file path (defaults to "meta-bun.db").
	 */
	constructor(path: string = "meta-bun.db") {
		this.dbPath = path;
		this.LoadDriverConfig();
		this.db = new Database(this.dbPath);
		this.Initialize();
	}

	private LoadDriverConfig(): void {
		try {
			const configPath = join(
				process.cwd(),
				"configs",
				"core",
				"database.json",
			);
			if (existsSync(configPath)) {
				const content = readFileSync(configPath, "utf-8");
				const config = JSON.parse(content);
				this.driver = Bun.env["DB_DRIVER"] || config.driver || "sqlite";

				if (this.driver === "mysql" || this.driver === "postgres") {
					const settings = config[this.driver] || {};
					const host = Bun.env["DB_HOST"] || settings.host || "127.0.0.1";
					const port =
						Bun.env["DB_PORT"] ||
						settings.port ||
						(this.driver === "mysql" ? 3306 : 5432);
					const user = Bun.env["DB_USER"] || settings.user || "root";
					const database =
						Bun.env["DB_NAME"] || settings.database || "meta_bun";
					console.log(
						`[DatabaseManager] Mocking connection to ${this.driver.toUpperCase()} database at ${host}:${port} (DB: ${database}, User: ${user})`,
					);
				} else {
					console.log(`[DatabaseManager] Initialized with SQLite driver.`);
				}
			} else {
				this.driver = Bun.env["DB_DRIVER"] || "sqlite";
				if (this.driver !== "sqlite") {
					console.log(
						`[DatabaseManager] Mocking connection to ${this.driver.toUpperCase()} database (from env settings)`,
					);
				}
			}
		} catch (err) {
			console.error(
				"[DatabaseManager] Error loading database config, defaulting to SQLite:",
				err,
			);
			this.driver = "sqlite";
		}
	}

	/**
	 * Creates the required SQLite tables and handles schema migrations.
	 */
	private Initialize(): void {
		this.db.run(`
      CREATE TABLE IF NOT EXISTS players (
        steamid TEXT PRIMARY KEY,
        last_name TEXT,
        total_kills INTEGER DEFAULT 0,
        total_deaths INTEGER DEFAULT 0,
        total_assists INTEGER DEFAULT 0,
        total_headshots INTEGER DEFAULT 0,
        total_damage INTEGER DEFAULT 0,
        total_mvps INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_gagged INTEGER DEFAULT 0
      )
    `);
		this.db.run(`
      CREATE TABLE IF NOT EXISTS bans (
        steamid TEXT PRIMARY KEY,
        reason TEXT,
        admin_steamid TEXT,
        duration INTEGER,
        timestamp INTEGER,
        ip TEXT DEFAULT ''
      )
    `);
		this.db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        steamid TEXT PRIMARY KEY,
        flags TEXT,
        immunity INTEGER DEFAULT 0,
        groups TEXT DEFAULT '',
        expires_at INTEGER DEFAULT 0
      )
    `);
		this.db.run(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        admin_steamid TEXT,
        admin_name TEXT,
        target_steamid TEXT,
        target_name TEXT,
        action TEXT
      )
    `);
		this.db.run(`
      CREATE TABLE IF NOT EXISTS client_cookies (
        steamid TEXT,
        cookie_name TEXT,
        cookie_value TEXT,
        PRIMARY KEY (steamid, cookie_name)
      )
    `);

		// Migration updates for existing database versions
		try {
			this.db.run(
				"ALTER TABLE players ADD COLUMN total_headshots INTEGER DEFAULT 0",
			);
		} catch (_) {}
		try {
			this.db.run(
				"ALTER TABLE players ADD COLUMN total_damage INTEGER DEFAULT 0",
			);
		} catch (_) {}
		try {
			this.db.run(
				"ALTER TABLE players ADD COLUMN total_mvps INTEGER DEFAULT 0",
			);
		} catch (_) {}
		try {
			this.db.run(
				"ALTER TABLE players ADD COLUMN total_playtime INTEGER DEFAULT 0",
			);
		} catch (_) {}
		try {
			this.db.run("ALTER TABLE players ADD COLUMN is_muted INTEGER DEFAULT 0");
		} catch (_) {}
		try {
			this.db.run("ALTER TABLE players ADD COLUMN is_gagged INTEGER DEFAULT 0");
		} catch (_) {}
		try {
			this.db.run("ALTER TABLE admins ADD COLUMN expires_at INTEGER DEFAULT 0");
		} catch (_) {}
		try {
			this.db.run("ALTER TABLE bans ADD COLUMN ip TEXT DEFAULT ''");
		} catch (_) {}
	}

	/**
	 * Inserts a new player or updates (accumulates) stats for an existing player SteamID.
	 *
	 * @param playerData The stats of the player to upsert.
	 */
	public UpsertPlayer(playerData: IPlayerData): void {
		const query = this.db.prepare(`
      INSERT INTO players (steamid, last_name, total_kills, total_deaths, total_assists, total_headshots, total_damage, total_mvps, total_playtime, is_muted, is_gagged)
      VALUES ($steamid, $last_name, $total_kills, $total_deaths, $total_assists, $total_headshots, $total_damage, $total_mvps, $total_playtime, $is_muted, $is_gagged)
      ON CONFLICT(steamid) DO UPDATE SET
        last_name = excluded.last_name,
        total_kills = total_kills + excluded.total_kills,
        total_deaths = total_deaths + excluded.total_deaths,
        total_assists = total_assists + excluded.total_assists,
        total_headshots = total_headshots + excluded.total_headshots,
        total_damage = total_damage + excluded.total_damage,
        total_mvps = total_mvps + excluded.total_mvps,
        total_playtime = total_playtime + excluded.total_playtime,
        is_muted = excluded.is_muted,
        is_gagged = excluded.is_gagged
    `);

		query.run({
			$steamid: playerData.steamid,
			$last_name: playerData.last_name,
			$total_kills: playerData.total_kills,
			$total_deaths: playerData.total_deaths,
			$total_assists: playerData.total_assists,
			$total_headshots: playerData.total_headshots ?? 0,
			$total_damage: playerData.total_damage ?? 0,
			$total_mvps: playerData.total_mvps ?? 0,
			$total_playtime: playerData.total_playtime ?? 0,
			$is_muted: playerData.is_muted ?? 0,
			$is_gagged: playerData.is_gagged ?? 0,
		});
	}

	/**
	 * Fetches persisted player stats using SteamID.
	 *
	 * @param steamId Target SteamID.
	 * @returns Player stats or undefined if not found.
	 */
	public GetPlayer(steamId: string): IPlayerData | undefined {
		const query = this.db.prepare("SELECT * FROM players WHERE steamid = ?");
		return query.get(steamId) as IPlayerData | undefined;
	}

	/**
	 * Insert or overwrite a ban record.
	 *
	 * @param banData The ban details.
	 */
	public AddBan(banData: IBanData): void {
		const query = this.db.prepare(`
      INSERT OR REPLACE INTO bans (steamid, reason, admin_steamid, duration, timestamp, ip)
      VALUES ($steamid, $reason, $admin_steamid, $duration, $timestamp, $ip)
    `);
		query.run({
			$steamid: banData.steamid,
			$reason: banData.reason,
			$admin_steamid: banData.admin_steamid,
			$duration: banData.duration,
			$timestamp: banData.timestamp,
			$ip: banData.ip ?? "",
		});
	}

	/**
	 * Removes a ban record for a SteamID.
	 *
	 * @param steamId Target SteamID.
	 */
	public RemoveBan(steamId: string): void {
		const query = this.db.prepare("DELETE FROM bans WHERE steamid = ?");
		query.run(steamId);
	}

	/**
	 * Fetches a ban record using SteamID.
	 *
	 * @param steamId Target SteamID.
	 * @returns Ban data or undefined if not found.
	 */
	public GetBan(steamId: string): IBanData | undefined {
		const query = this.db.prepare("SELECT * FROM bans WHERE steamid = ?");
		return query.get(steamId) as IBanData | undefined;
	}

	/**
	 * Fetches a ban record using IP address.
	 */
	public GetBanByIp(ip: string): IBanData | undefined {
		if (!ip) return undefined;
		const query = this.db.prepare("SELECT * FROM bans WHERE ip = ?");
		return query.get(ip) as IBanData | undefined;
	}

	/**
	 * Fetches all bans stored in the database.
	 */
	public GetAllBans(): IBanData[] {
		const query = this.db.prepare("SELECT * FROM bans");
		return query.all() as IBanData[];
	}

	/**
	 * Adds or replaces an admin record in the database.
	 */
	public AddDatabaseAdmin(
		steamid: string,
		flags: string,
		immunity: number = 0,
		groups: string = "",
		expires_at: number = 0,
	): void {
		const query = this.db.prepare(`
      INSERT OR REPLACE INTO admins (steamid, flags, immunity, [groups], expires_at)
      VALUES ($steamid, $flags, $immunity, $groups, $expires_at)
    `);
		query.run({
			$steamid: steamid,
			$flags: flags,
			$immunity: immunity,
			$groups: groups,
			$expires_at: expires_at,
		});
	}

	/**
	 * Removes an admin record from the database.
	 */
	public RemoveDatabaseAdmin(steamid: string): void {
		const query = this.db.prepare("DELETE FROM admins WHERE steamid = ?");
		query.run(steamid);
	}

	/**
	 * Fetches all dynamic database admins.
	 */
	public GetDatabaseAdmins(): Array<{
		steamid: string;
		flags: string;
		immunity: number;
		groups: string;
		expires_at: number;
	}> {
		const query = this.db.prepare("SELECT * FROM admins");
		return query.all() as Array<{
			steamid: string;
			flags: string;
			immunity: number;
			groups: string;
			expires_at: number;
		}>;
	}

	/**
	 * Adds an administrative log entry to the database.
	 */
	public AddAdminLog(
		adminSteamId: string,
		adminName: string,
		targetSteamId: string,
		targetName: string,
		action: string,
	): void {
		const query = this.db.prepare(`
      INSERT INTO admin_logs (timestamp, admin_steamid, admin_name, target_steamid, target_name, action)
      VALUES ($timestamp, $admin_steamid, $admin_name, $target_steamid, $target_name, $action)
    `);
		query.run({
			$timestamp: Date.now(),
			$admin_steamid: adminSteamId,
			$admin_name: adminName,
			$target_steamid: targetSteamId,
			$target_name: targetName,
			$action: action,
		});
	}

	/**
	 * Sets a persistent cookie value for a SteamID.
	 */
	public SetCookie(steamId: string, name: string, value: string): void {
		const query = this.db.prepare(`
      INSERT OR REPLACE INTO client_cookies (steamid, cookie_name, cookie_value)
      VALUES ($steamid, $cookie_name, $cookie_value)
    `);
		query.run({
			$steamid: steamId,
			$cookie_name: name,
			$cookie_value: value,
		});
	}

	/**
	 * Retrieves a persistent cookie value for a SteamID.
	 */
	public GetCookie(steamId: string, name: string): string {
		const query = this.db.prepare(
			"SELECT cookie_value FROM client_cookies WHERE steamid = ? AND cookie_name = ?",
		);
		const row = query.get(steamId, name) as
			| { cookie_value: string }
			| undefined;
		return row ? row.cookie_value : "";
	}

	/**
	 * Proxies a prepare() call to the underlying SQLite database.
	 */
	public prepare(sql: string): ReturnType<Database["prepare"]> {
		return this.db.prepare(sql);
	}

	/**
	 * Proxies a run() call to the underlying SQLite database.
	 */
	public run(sql: string, ...args: any[]): ReturnType<Database["run"]> {
		return this.db.run(sql, ...args);
	}

	/**
	 * Safely closes the database connection.
	 */
	public close(): void {
		this.db.close();
	}

	/**
	 * Clears all tables in the database (used primarily for testing).
	 */
	public clearAll(): void {
		try {
			this.db.run("DELETE FROM players");
			this.db.run("DELETE FROM bans");
			this.db.run("DELETE FROM admins");
			this.db.run("DELETE FROM admin_logs");
			this.db.run("DELETE FROM client_cookies");
		} catch (_err) {
			// Ignore if table doesn't exist yet
		}
	}
}
