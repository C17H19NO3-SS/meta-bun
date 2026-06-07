import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseManager } from "../shared/database";
import { discordService } from "../shared/discord";

/**
 * Manages player bans, handling ban checks and database logging.
 * All methods are synchronous — the database operations use Bun's native
 * SQLite driver which is inherently synchronous.
 */
export class BanManager {
	private db: DatabaseManager;
	private settings: any = null;

	/**
	 * Initializes the BanManager.
	 *
	 * @param db The database manager to store and query bans.
	 */
	constructor(db: DatabaseManager) {
		this.db = db;
		this.LoadConfig();
	}

	private LoadConfig(): void {
		try {
			const configPath = join(
				process.cwd(),
				"configs",
				"core",
				"settings.json",
			);
			if (existsSync(configPath)) {
				this.settings = JSON.parse(readFileSync(configPath, "utf-8"));
			}
		} catch (_err) {
			// Ignore
		}
	}

	/**
	 * Checks whether a player's SteamID or IP address is banned and the ban has not yet expired.
	 * Expired bans are automatically removed from the database.
	 *
	 * @param steamId SteamID of the player.
	 * @param ip Optional IP address of the player.
	 * @returns True if actively banned, false otherwise.
	 */
	public CheckBan(steamId: string, ip?: string): boolean {
		let ban = this.db.GetBan(steamId);
		if (!ban && ip) {
			ban = this.db.GetBanByIp(ip);
		}
		if (!ban) return false;

		// Duration 0 = permanent ban
		if (ban.duration === 0) return true;

		const now = Date.now();
		const expiry = ban.timestamp + ban.duration * 60 * 1000;

		if (expiry <= now) {
			// Ban has expired — clean it up
			this.db.RemoveBan(ban.steamid);
			return false;
		}

		return true;
	}

	/**
	 * Records a ban entry for a SteamID in the database.
	 *
	 * @param steamId Target player SteamID.
	 * @param reason Reason for the ban.
	 * @param adminSteamId SteamID of the banning administrator.
	 * @param duration Ban duration in minutes (0 = permanent).
	 * @param ip Optional IP address of the player.
	 */
	public BanClient(
		steamId: string,
		reason: string,
		adminSteamId: string,
		duration: number,
		ip: string = "",
	): void {
		this.db.AddBan({
			steamid: steamId,
			reason,
			admin_steamid: adminSteamId,
			duration,
			timestamp: Date.now(),
			ip,
		});

		const logChannelId =
			process.env.DISCORD_LOG_CHANNEL_ID ||
			this.settings?.discord?.log_channel_id;
		if (logChannelId) {
			const durationText = duration === 0 ? "Kalıcı" : `${duration} dakika`;
			const discordPayload = {
				title: "🚫 Oyuncu Yasaklandı",
				color: 16711680, // Red
				fields: [
					{ name: "Yasaklanan SteamID", value: steamId, inline: true },
					{ name: "Süre", value: durationText, inline: true },
					{ name: "Sebep", value: reason, inline: false },
					{ name: "Yasaklayan Yetkili", value: adminSteamId, inline: true },
					{ name: "IP Adresi", value: ip || "Bilinmiyor", inline: true },
				],
				timestamp: new Date().toISOString(),
			};
			discordService
				.SendMessage("admin-bans", logChannelId, discordPayload)
				.catch((err) => console.error("[Discord Logger] Ban log failed:", err));
		}
	}

	/**
	 * Removes a ban record for a SteamID from the database.
	 *
	 * @param steamId Target player SteamID.
	 */
	public RemoveBan(steamId: string): void {
		this.db.RemoveBan(steamId);
	}

	/**
	 * Sweeps and removes all expired bans from the database.
	 */
	public SweepExpiredBans(): void {
		const bans = this.db.GetAllBans();
		const now = Date.now();
		for (const ban of bans) {
			if (ban.duration === 0) continue;
			const expiry = ban.timestamp + ban.duration * 60 * 1000;
			if (expiry <= now) {
				this.db.RemoveBan(ban.steamid);
			}
		}
	}
}
