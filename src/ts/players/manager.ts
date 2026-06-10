import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BanManager } from "../admins/bans";
import type { Bridge } from "../network/bridge";
import { PluginManager } from "../plugin-system/manager";
import { DatabaseManager } from "../shared/database";
import type { IAdminManager } from "../shared/types/admin";
import { Team } from "../shared/types/enums";
import type { IPlayer, IPlayerManager } from "../shared/types/player";
import { Player } from "./player";

/**
 * Manages player sessions, persistence saves, reservations, and AFK checks.
 */
export class PlayerManager implements IPlayerManager {
	private players = new Map<number, IPlayer>();
	public readonly db: DatabaseManager;
	private reservedSlotsConfig = {
		reserved_slots_count: 0,
		kick_method: "highest_idle",
		min_immunity: 10,
	};

	private consolePlayer: IPlayer | null = null;

	/**
	 * Initializes the PlayerManager.
	 *
	 * @param db The DatabaseManager instance.
	 * @param enableCheckpointing Whether stats auto-save checkpoints are run periodically.
	 */
	constructor(db?: DatabaseManager, enableCheckpointing: boolean = false) {
		this.db = db || new DatabaseManager();
		this.LoadReservedSlotsConfig();
		if (enableCheckpointing) {
			setInterval(() => this.Checkpoint(), 5 * 60 * 1000); // 5 minutes
		}
	}

	private LoadReservedSlotsConfig(): void {
		try {
			const configPath = join(process.cwd(), "configs", "reserved_slots.json");
			if (existsSync(configPath)) {
				const content = readFileSync(configPath, "utf-8");
				this.reservedSlotsConfig = JSON.parse(content);
			}
		} catch (e) {
			PluginManager.GlobalLog(
				`Error loading reserved_slots.json: ${e}`,
				"error",
			);
		}
	}

	/**
	 * Periodically saves stats for all connected players to prevent data loss.
	 */
	public Checkpoint(): void {
		for (const player of this.players.values()) {
			this.db.UpsertPlayer({
				steamid: player.steamId,
				last_name: player.name,
				total_kills: player.GetTotalKills(),
				total_deaths: player.GetTotalDeaths(),
				total_assists: player.GetTotalAssists(),
				total_headshots: player.GetHeadshots(),
				total_damage: player.GetDamage(),
				total_mvps: player.GetMVPs(),
				total_playtime: player.GetPlaytime(),
				is_muted: player.IsMuted() ? 1 : 0,
				is_gagged: player.IsGagged() ? 1 : 0,
			});
		}
	}

	/**
	 * Adds a player session and restores persistent statistics from the database.
	 * If a player already occupies the same slot index, that session is saved and
	 * removed first to prevent data corruption.
	 *
	 * @param player The player instance.
	 */
	public AddPlayer(player: IPlayer): void {
		// Guard: if this slot is already occupied (e.g. rapid reconnect), clean up first
		const existing = this.players.get(player.index);
		if (existing) {
			PluginManager.GlobalLog(
				`Slot ${player.index} already occupied by ${existing.name}. Removing before adding ${player.name}.`,
				"warn",
			);
			this.RemovePlayer(player.index);
		}

		// Load persistent data from DB
		const data = this.db.GetPlayer(player.steamId);
		if (data && player instanceof Player) {
			const hasNoStats =
				player.GetTotalKills() === 0 &&
				player.GetTotalDeaths() === 0 &&
				player.GetTotalAssists() === 0;
			if (hasNoStats) {
				player.SetTotalStats(
					data.total_kills,
					data.total_deaths,
					data.total_assists,
				);
				player.SetAdvancedStats(
					data.total_headshots ?? 0,
					data.total_damage ?? 0,
					data.total_mvps ?? 0,
					data.total_playtime ?? 0,
				);
			}
			if (data.is_muted === 1) {
				player.Mute();
			}
			if (data.is_gagged === 1) {
				player.Gag();
			}
		}
		this.players.set(player.index, player);
	}

	/**
	 * Saves stats and removes a player session upon disconnect.
	 *
	 * @param index Player index.
	 */
	public RemovePlayer(index: number): void {
		const player = this.players.get(index);
		if (player) {
			// Save data to DB
			this.db.UpsertPlayer({
				steamid: player.steamId,
				last_name: player.name,
				total_kills: player.GetTotalKills(),
				total_deaths: player.GetTotalDeaths(),
				total_assists: player.GetTotalAssists(),
				total_headshots: player.GetHeadshots(),
				total_damage: player.GetDamage(),
				total_mvps: player.GetMVPs(),
				total_playtime: player.GetPlaytime(),
				is_muted: player.IsMuted() ? 1 : 0,
				is_gagged: player.IsGagged() ? 1 : 0,
			});
			this.players.delete(index);
		}
	}

	/**
	 * Scans and kicks or moves AFK players to spectators if they exceed idle time.
	 *
	 * @param maxIdleSeconds Maximum idle duration allowed.
	 * @param action "spec" to move to spectator, "kick" to remove from server.
	 */
	public CheckAFKPlayers(
		maxIdleSeconds: number,
		action: "spec" | "kick" = "spec",
	): void {
		for (const player of this.players.values()) {
			if (player.GetTeam() !== Team.Spectator) {
				const idle = player.GetIdleTime();
				if (idle >= maxIdleSeconds) {
					if (action === "spec") {
						player.SetTeam(Team.Spectator);
						player.Say("You have been moved to spectator for being AFK.");
					} else if (action === "kick") {
						player.Kick("Kicked for being AFK.");
					}
				}
			}
		}
	}

	/**
	 * Manages reservation checks. Determines if normal players should be kicked to make room for a VIP.
	 *
	 * @param connectingSteamId SteamID of connecting player.
	 * @param connectingFlags Permission flags of connecting player.
	 * @param maxClients Maximum player slots.
	 */
	public CheckReservation(
		_connectingSteamId: string,
		connectingFlags: string,
		maxClients: number = 32,
	): { allowed: boolean; kickIndex?: number } {
		const currentClients = this.players.size;
		const slotsLimit =
			maxClients - this.reservedSlotsConfig.reserved_slots_count;
		const isVip =
			connectingFlags.includes("a") || connectingFlags.includes("z");

		if (currentClients < slotsLimit) {
			return { allowed: true };
		}

		if (currentClients < maxClients && isVip) {
			return { allowed: true };
		}

		if (!isVip) {
			return { allowed: false };
		}

		let bestCandidate: IPlayer | null = null;

		if (this.reservedSlotsConfig.kick_method === "highest_ping") {
			let maxPing = -1;
			for (const player of this.players.values()) {
				const playerFlags = player.GetAdminFlags();
				const isPlayerVip =
					playerFlags.includes("a") || playerFlags.includes("z");
				if (isPlayerVip) continue;

				const ping = player.GetPing();
				if (ping > maxPing) {
					maxPing = ping;
					bestCandidate = player;
				}
			}
		} else {
			let maxIdleTime = -1;
			for (const player of this.players.values()) {
				const playerFlags = player.GetAdminFlags();
				const isPlayerVip =
					playerFlags.includes("a") || playerFlags.includes("z");
				if (isPlayerVip) continue;

				const idleTime = player.GetIdleTime();
				if (idleTime > maxIdleTime) {
					maxIdleTime = idleTime;
					bestCandidate = player;
				}
			}
		}

		if (bestCandidate) {
			return { allowed: true, kickIndex: bestCandidate.index };
		}

		return { allowed: false };
	}

	public Get(index: number): IPlayer | undefined {
		if (index === 0) return this.consolePlayer || undefined;
		return this.players.get(index);
	}

	public GetByUserId(userId: number): IPlayer | undefined {
		if (userId === 0) return this.consolePlayer || undefined;
		return Array.from(this.players.values()).find((p) => p.userId === userId);
	}

	public InitializeConsole(
		bridge: Bridge,
		adminManager: IAdminManager,
		banManager: BanManager,
	): void {
		const consolePlayer = new Player(
			bridge,
			adminManager,
			banManager,
			0,
			"Console",
			"STEAM_ID_SERVER",
			0,
			false,
		);
		this.consolePlayer = consolePlayer;
	}

	/**
	 * Finds player by nickname.
	 */
	public FindByName(name: string): IPlayer | undefined {
		return Array.from(this.players.values()).find((p) => p.name === name);
	}

	/**
	 * Finds player by SteamID.
	 */
	public FindBySteamId(steamId: string): IPlayer | undefined {
		return Array.from(this.players.values()).find((p) => p.steamId === steamId);
	}

	/**
	 * Returns all connected player sessions.
	 */
	public GetAll(): IPlayer[] {
		return Array.from(this.players.values());
	}

	/**
	 * Gets all players on a team.
	 */
	public GetClientsByTeam(team: Team): IPlayer[] {
		return Array.from(this.players.values()).filter(
			(p) => p.GetTeam() === team,
		);
	}

	/**
	 * Gets all alive players.
	 */
	public GetAliveClients(): IPlayer[] {
		return Array.from(this.players.values()).filter((p) => p.IsAlive());
	}

	/**
	 * Gets all fully connected players in-game.
	 */
	public GetInGameClients(): IPlayer[] {
		return Array.from(this.players.values());
	}

	/**
	 * Finds players matching a pattern (e.g., "@all", "@ct", "#12", "name").
	 * Supports comma-separated patterns.
	 *
	 * @param pattern The targeting pattern.
	 * @param callerIndex Optional index of the player who is performing the search.
	 */
	public FindTargets(pattern: string, callerIndex?: number): IPlayer[] {
		if (!pattern) return [];

		const subPatterns = pattern.split(",").map((p) => p.trim());
		const allMatches = new Set<IPlayer>();

		for (const subPattern of subPatterns) {
			const matches = this.ResolveSingleTarget(subPattern, callerIndex);
			for (const match of matches) {
				allMatches.add(match);
			}
		}

		return Array.from(allMatches);
	}

	private ResolveSingleTarget(
		pattern: string,
		callerIndex?: number,
	): IPlayer[] {
		const allInGame = this.GetInGameClients();
		const lowerPattern = pattern.toLowerCase();

		if (lowerPattern === "@all" || lowerPattern === "*") {
			return allInGame;
		}

		if (lowerPattern === "@ct") {
			return allInGame.filter((p) => p.GetTeam() === Team.CT);
		}

		if (lowerPattern === "@t") {
			return allInGame.filter((p) => p.GetTeam() === Team.Terrorist);
		}

		if (lowerPattern === "@spec") {
			return allInGame.filter((p) => p.GetTeam() === Team.Spectator);
		}

		if (lowerPattern === "@alive") {
			return allInGame.filter((p) => p.IsAlive());
		}

		if (lowerPattern === "@dead") {
			return allInGame.filter((p) => !p.IsAlive());
		}

		if (lowerPattern === "@me") {
			if (callerIndex !== undefined) {
				const caller = this.Get(callerIndex);
				return caller ? [caller] : [];
			}
			return [];
		}

		if (lowerPattern === "!@me" || lowerPattern === "@!me") {
			return allInGame.filter((p) => p.index !== callerIndex);
		}

		if (lowerPattern === "@bots") {
			return allInGame.filter((p) => p.IsBot());
		}

		if (lowerPattern === "@humans") {
			return allInGame.filter((p) => !p.IsBot());
		}

		if (lowerPattern === "@random") {
			if (allInGame.length === 0) return [];
			const rndIndex = Math.floor(Math.random() * allInGame.length);
			const chosen = allInGame[rndIndex];
			return chosen ? [chosen] : [];
		}

		if (lowerPattern === "@aim") {
			// Simplified: just return first other player for now if callerIndex is provided
			const otherPlayers = allInGame.filter((p) => p.index !== callerIndex);
			return otherPlayers.length > 0 ? [otherPlayers[0]] : [];
		}

		// Fallbacks:
		// 1. UserID match if prefixed with '#'
		if (pattern.startsWith("#")) {
			const userIdVal = parseInt(pattern.substring(1), 10);
			if (!Number.isNaN(userIdVal)) {
				const match = allInGame.find((p) => p.userId === userIdVal);
				if (match) return [match];
			}
		}

		// 2. Client index match (plain number)
		const idxVal = parseInt(pattern, 10);
		if (!Number.isNaN(idxVal) && idxVal > 0) {
			const match = this.Get(idxVal);
			if (match) return [match];
		}

		// 3. Exact name match (case-sensitive first)
		const exactMatch = allInGame.find((p) => p.name === pattern);
		if (exactMatch) return [exactMatch];

		// 4. Case-insensitive name match
		const exactMatchCI = allInGame.find(
			(p) => p.name.toLowerCase() === lowerPattern,
		);
		if (exactMatchCI) return [exactMatchCI];

		// 5. Partial name match (case-insensitive substring)
		const partialMatches = allInGame.filter((p) =>
			p.name.toLowerCase().includes(lowerPattern),
		);
		if (partialMatches.length > 0) {
			return partialMatches;
		}

		return [];
	}
}
