import type { Team } from "./enums";
import type { Weapon } from "./weapon";

export interface SteamProfile {
	avatar: string;
	avatarmedium: string;
	avatarfull: string;
	realname?: string;
	personaname: string;
	profileurl: string;
	loccountrycode?: string;
}

/**
 * Interface representing a player (client), including their attributes, statistics, and actions.
 */
export interface IPlayer {
	/**
	 * Server index of the player (typically between 1 and 32).
	 */
	readonly index: number;

	/**
	 * Name/Nickname of the player on the server.
	 */
	readonly name: string;

	/**
	 * SteamID of the player (e.g., STEAM_1:0:12345).
	 */
	readonly steamId: string;

	/**
	 * Unique UserId of the player on the server.
	 */
	readonly userId: number;

	/**
	 * Optional Steam Web API profile data.
	 */
	steamProfile?: SteamProfile;

	// Stats
	/**
	 * Get the current health value of the player.
	 */
	GetHealth(): number;

	/**
	 * Get the current armor value of the player.
	 */
	GetArmor(): number;

	/**
	 * Get the current money amount of the player.
	 */
	GetMoney(): number;

	/**
	 * Get the current team of the player.
	 */
	GetTeam(): Team;

	/**
	 * Get the kills count of the player in the current map session.
	 */
	GetKills(): number;

	/**
	 * Get the deaths count of the player in the current map session.
	 */
	GetDeaths(): number;

	/**
	 * Get the assists count of the player in the current map session.
	 */
	GetAssists(): number;

	/**
	 * Check if the player is currently alive.
	 */
	IsAlive(): boolean;

	/**
	 * Get the current network ping of the player (ms).
	 */
	GetPing(): number;

	/**
	 * Get the preferred language code of the player (e.g., "tr", "en").
	 */
	GetLanguage(): string;

	/**
	 * Gets the admin permission flags string for this player.
	 */
	GetAdminFlags(): string;

	/**
	 * Gets the admin immunity rating for this player.
	 */
	GetAdminImmunity(): number;

	/**
	 * Get the name of the active weapon currently held by the player.
	 */
	GetWeapon(): string;

	// Total persistent stats
	/**
	 * Get the total persistent kills count of the player from the database.
	 */
	GetTotalKills(): number;

	/**
	 * Get the total persistent deaths count of the player from the database.
	 */
	GetTotalDeaths(): number;

	/**
	 * Get the total persistent assists count of the player from the database.
	 */
	GetTotalAssists(): number;

	// CS2 Metadata
	/**
	 * Check if the player is a bot (AI).
	 */
	IsBot(): boolean;

	/**
	 * Get a map of all weapons and their attributes in the player's inventory.
	 */
	GetInventory(): Map<string, Weapon>;

	/**
	 * Check if the player has the specified weapon in their inventory.
	 */
	HasWeapon(weaponName: string): boolean;

	/**
	 * Get the 3D world coordinates (X, Y, Z) of the player.
	 */
	GetLocation(): { x: number; y: number; z: number };

	/**
	 * Get the look angles (Pitch, Yaw, Roll) of the player.
	 */
	GetAngles(): { x: number; y: number; z: number };

	// Actions
	/**
	 * Send a chat message either privately or on behalf of the player.
	 */
	Say(message: string): void;

	/**
	 * Prints a hint message to the player's HUD.
	 */
	PrintHintText(message: string): void;

	/**
	 * Kick the player from the server with an optional reason.
	 */
	Kick(reason?: string): void;

	/**
	 * Slap the player, applying optional damage.
	 */
	Slap(damage: number): void;

	/**
	 * Teleport the player to the specified world coordinates.
	 */
	Teleport(x: number, y: number, z: number): void;

	/**
	 * Fade the player's screen to a specific color.
	 * @param duration Duration of the fade in milliseconds.
	 * @param color Hex color or color name (e.g. #FF0000 or red).
	 */
	ScreenFade(
		durationMs: number,
		r: number,
		g: number,
		b: number,
		a: number,
	): void;

	/**
	 * Shake the player's screen.
	 * @param amplitude Intensity of the shake.
	 * @param duration Duration of the shake in milliseconds.
	 */
	ScreenShake(amplitude: number, durationMs: number): void;

	/**
	 * Change the player's team.
	 */
	SetTeam(team: Team): void;

	/**
	 * Respawn the player.
	 */
	Respawn(): void;

	/**
	 * Check if this player has the specified admin permission flag.
	 */
	HasFlag(flag: string): boolean;

	// Movement & Visuals
	/**
	 * Set the gravity multiplier of the player (e.g., 1.0 is normal, 0.5 is low gravity).
	 */
	SetGravity(gravity: number): void;

	/**
	 * Set the move type mode of the player (e.g., noclip, normal).
	 */
	SetMoveType(movetype: number): void;

	/**
	 * Set the health of the player directly.
	 */
	SetHealth(health: number): void;

	/**
	 * Set the character model (skin) of the player.
	 */
	SetModel(model: string): void;

	/**
	 * Set the render color and alpha transparency (RGBA) of the player.
	 */
	SetRenderColor(r: number, g: number, b: number, a: number): void;

	/**
	 * Emit a sound path to the player.
	 */
	EmitSound(
		soundPath: string,
		volume?: number,
		channel?: number,
		pitch?: number,
	): void;

	// Susturma Sistemi (Mute/Gag)
	/**
	 * Check if the player's voice chat is muted.
	 */
	IsMuted(): boolean;

	/**
	 * Check if the player's text chat is gagged.
	 */
	IsGagged(): boolean;

	/**
	 * Mute the player's voice chat.
	 */
	Mute(): void;

	/**
	 * Unmute the player's voice chat.
	 */
	Unmute(): void;

	/**
	 * Gag the player's text chat.
	 */
	Gag(): void;

	/**
	 * Ungag the player's text chat.
	 */
	Ungag(): void;

	/**
	 * Silence the player (both mute and gag).
	 */
	Silence(): void;

	/**
	 * Unsilence the player (removes both mute and gag).
	 */
	Unsilence(): void;

	// Detaylı İstatistik Takibi
	/**
	 * Get the player's headshots count.
	 */
	GetHeadshots(): number;

	/**
	 * Get the total damage dealt by the player.
	 */
	GetDamage(): number;

	/**
	 * Get the count of MVP awards earned by the player.
	 */
	GetMVPs(): number;

	/**
	 * Get the total accumulated playtime of the player (in seconds).
	 */
	GetPlaytime(): number;

	/**
	 * Increment the player's headshots count by 1.
	 */
	AddHeadshot(): void;

	/**
	 * Add a value to the player's total damage dealt.
	 */
	AddDamage(val: number): void;

	/**
	 * Increment the player's MVPs count by 1.
	 */
	AddMVP(): void;

	// AFK & Aktiflik Takibi
	/**
	 * Get the timestamp of the player's last interaction (movement, fire, chat).
	 */
	GetLastActiveTime(): number;

	/**
	 * Reset the player's last active time to the current timestamp.
	 */
	ResetActiveTime(): void;

	/**
	 * Get the duration (in seconds) the player has been AFK (idle).
	 */
	GetIdleTime(): number;

	// Immunity
	/**
	 * Get the admin immunity level of the player.
	 */
	GetImmunity(): number;

	/**
	 * Check if this player can target another player based on immunity hierarchy.
	 */
	CanTarget(target: IPlayer): boolean;

	// GeoIP / Country Lookup
	/**
	 * Get the IP address of the player.
	 */
	GetIPAddress(): string;

	/**
	 * Get the country of the player based on their IP address.
	 */
	GetCountry(): string;

	/**
	 * Manually set the IP address of the player.
	 */
	SetIPAddress(ip: string): void;

	// Advanced SourceMod Features
	/** Check if the player is in observer/spectator mode. */
	IsObserver(): boolean;
	/** Get the client index the player is currently spectating. */
	GetObserverTarget(): number;
	/** Get engine entity flags bitmask. */
	GetEntityFlags(): number;
	/** Get current movement buttons bitmask. */
	GetButtons(): number;
	/** Get current velocity vector. */
	GetVelocity(): { x: number; y: number; z: number };
	/** Get current primary weapon clip ammo. */
	GetClip1(): number;
	/** Get current primary weapon reserve ammo. */
	GetReserve1(): number;
	/** Set player velocity vector. */
	SetVelocity(x: number, y: number, z: number): void;
	/** Get current scoreboard clan tag. */
	GetClanTag(): string;
	/** Set player scoreboard clan tag. */
	SetClanTag(tag: string): void;
	/** Check if the player is forced into observer mode. */
	IsForcedObserver(): boolean;
	/** Set whether the player is forced into observer mode. */
	SetForcedObserver(forced: boolean): void;
}

/**
 * Interface for managing and searching players on the server.
 */
export interface IPlayerManager {
	/**
	 * Get a player by their index.
	 */
	Get(index: number): IPlayer | undefined;

	/**
	 * Find a player by exact name match.
	 */
	FindByName(name: string): IPlayer | undefined;

	/**
	 * Find a player by their SteamID.
	 */
	FindBySteamId(steamId: string): IPlayer | undefined;

	/**
	 * Get a list of all active players on the server.
	 */
	GetAll(): IPlayer[];

	/**
	 * Get all players on the specified team.
	 */
	GetClientsByTeam(team: Team): IPlayer[];

	/**
	 * Get all players who are currently alive.
	 */
	GetAliveClients(): IPlayer[];

	/**
	 * Get all players who are fully connected in-game.
	 */
	GetInGameClients(): IPlayer[];

	/**
	 * Check for AFK players and apply actions (spec or kick) if idle limit is reached.
	 *
	 * @param maxIdleSeconds Maximum idle duration allowed (in seconds).
	 * @param action Action to perform: "spec" or "kick".
	 */
	CheckAFKPlayers(maxIdleSeconds: number, action?: "spec" | "kick"): void;

	/**
	 * Check reservation slot availability when a player connects.
	 *
	 * @param connectingSteamId SteamID of the connecting player.
	 * @param connectingFlags Admin flags of the connecting player.
	 * @param maxClients Maximum player slots on the server.
	 */
	CheckReservation(
		connectingSteamId: string,
		connectingFlags: string,
		maxClients?: number,
	): { allowed: boolean; kickIndex?: number };

	/**
	 * Immediately flush all connected players' stats to the database.
	 * Useful for crash-safe saves or admin-triggered snapshots.
	 */
	Checkpoint(): void;

	/**
	 * Finds players matching a pattern (e.g., "@all", "@ct", "#12", "name").
	 * Supports comma-separated patterns.
	 *
	 * @param pattern The targeting pattern.
	 * @param callerIndex Optional index of the player who is performing the search.
	 */
	FindTargets(pattern: string, callerIndex?: number): IPlayer[];
}
