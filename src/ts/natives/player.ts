import { GetContext } from "../shared/context-store";
import type { Team } from "../shared/types/enums";
import type { IPlayer } from "../shared/types/player";

export { Team } from "../shared/types/enums";

/**
 * Proxied players manager providing utilities to query, search, and list
 * active in-game players.
 */
export const players = {
	/**
	 * Retrieves a player object by their client index.
	 *
	 * @param index Client index (1-based).
	 * @returns The Player instance or undefined if not found.
	 */
	Get(index: number): IPlayer | undefined {
		return GetContext().players.Get(index);
	},

	/**
	 * Searches for an in-game player by their name.
	 *
	 * @param name The target player's name.
	 * @returns The Player instance or undefined if not found.
	 */
	FindByName(name: string): IPlayer | undefined {
		return GetContext().players.FindByName(name);
	},

	/**
	 * Searches for a player using their SteamID.
	 *
	 * @param steamId The SteamID to search for (e.g. "STEAM_0:1:23456").
	 * @returns The Player instance or undefined if not found.
	 */
	FindBySteamId(steamId: string): IPlayer | undefined {
		return GetContext().players.FindBySteamId(steamId);
	},

	/**
	 * Retrieves all registered players (both in-game and connecting).
	 *
	 * @returns An array of all Player instances.
	 */
	GetAll(): IPlayer[] {
		return GetContext().players.GetAll();
	},

	/**
	 * Retrieves all clients belonging to a specific team.
	 *
	 * @param team The team identifier/index (e.g., CT or Terrorist).
	 * @returns Array of Player instances on that team.
	 */
	GetClientsByTeam(team: Team): IPlayer[] {
		return GetContext().players.GetClientsByTeam(team);
	},

	/**
	 * Retrieves all players who are currently alive.
	 *
	 * @returns Array of living Player instances.
	 */
	GetAliveClients(): IPlayer[] {
		return GetContext().players.GetAliveClients();
	},

	/**
	 * Retrieves all players who have fully spawned and are in game.
	 *
	 * @returns Array of in-game Player instances.
	 */
	GetInGameClients(): IPlayer[] {
		return GetContext().players.GetInGameClients();
	},

	/**
	 * Finds players matching a pattern (e.g., "@all", "@ct", "#12", "name").
	 * Supports comma-separated patterns.
	 *
	 * @param pattern The targeting pattern.
	 * @param callerIndex Optional index of the player who is performing the search.
	 * @returns Array of matching IPlayer instances.
	 */
	FindTargets(pattern: string, callerIndex?: number): IPlayer[] {
		return GetContext().players.FindTargets(pattern, callerIndex);
	},
};

/**
 * Gets a client's visible name.
 *
 * @param client Client index.
 * @returns Client's name.
 */
export function GetClientName(client: number): string {
	return GetContext().GetClientName(client);
}

/**
 * Gets a client's SteamID.
 *
 * @param client Client index.
 * @returns SteamID.
 */
export function GetClientAuthId(client: number): string {
	return GetContext().GetClientAuthId(client);
}

/**
 * Gets the numeric UserID assigned to a client by the engine.
 *
 * @param client Client index.
 * @returns Engine UserID.
 */
export function GetClientUserId(client: number): number {
	return GetContext().GetClientUserId(client);
}

/**
 * Gets a client's health points.
 *
 * @param client Client index.
 * @returns Health points.
 */
export function GetClientHealth(client: number): number {
	return GetContext().GetClientHealth(client);
}

/**
 * Gets a client's current in-game money.
 *
 * @param client Client index.
 * @returns Current money.
 */
export function GetClientMoney(client: number): number {
	return GetContext().GetClientMoney(client);
}

/**
 * Gets a client's team index.
 *
 * @param client Client index.
 * @returns Team index.
 */
export function GetClientTeam(client: number): number {
	return GetContext().GetClientTeam(client);
}

/**
 * Checks if a client is active and fully in the game.
 *
 * @param client Client index.
 * @returns True if in-game, false otherwise.
 */
export function IsClientInGame(client: number): boolean {
	return GetContext().IsClientInGame(client);
}

/**
 * Checks if a player client is currently alive.
 *
 * @param client Client index.
 * @returns True if alive, false otherwise.
 */
export function IsPlayerAlive(client: number): boolean {
	return GetContext().IsPlayerAlive(client);
}

/**
 * Slaps a player entity, optionally inflicting damage and making them jump/move.
 *
 * @param client Client index.
 * @param damage Damage points to inflict.
 */
export function SlapPlayer(client: number, damage: number): void {
	GetContext().SlapPlayer(client, damage);
}

/**
 * Teleports a player to a specific 3D coordinate vector.
 *
 * @param client Client index.
 * @param x X coordinate.
 * @param y Y coordinate.
 * @param z Z coordinate.
 */
export function TeleportEntity(
	client: number,
	x: number,
	y: number,
	z: number,
): void {
	GetContext().TeleportEntity(client, x, y, z);
}

/**
 * Changes a player's team.
 *
 * @param client Client index.
 * @param team Team index (e.g. 2 for Terrorist, 3 for CT).
 */
export function ChangeClientTeam(client: number, team: number): void {
	GetContext().ChangeClientTeam(client, team);
}

/**
 * Respawns a player back into the arena.
 *
 * @param client Client index.
 */
export function RespawnPlayer(client: number): void {
	GetContext().RespawnPlayer(client);
}

/**
 * Kicks a client from the game server.
 *
 * @param client Client index.
 * @param reason Optional reason showing in their disconnection notice.
 */
export function KickClient(client: number, reason?: string): void {
	GetContext().KickClient(client, reason);
}

/**
 * Bans a client from the server, adding them to the ban manager database.
 *
 * @param steamId Target player SteamID.
 * @param reason Reason for the ban.
 * @param adminSteamId Actioning admin's SteamID.
 * @param duration Ban duration in minutes (0 for permanent).
 */
export function BanClient(
	steamId: string,
	reason: string,
	adminSteamId: string,
	duration: number,
	ip: string = "",
): void {
	GetContext().BanClient(steamId, reason, adminSteamId, duration, ip);
}

/**
 * Unbans a player, removing their ban from the database.
 *
 * @param steamId SteamID to remove from the ban list.
 */
export function RemoveBan(steamId: string): void {
	GetContext().RemoveBan(steamId);
}

/**
 * Gives an item/weapon to a player.
 *
 * @param client Client index.
 * @param item Item name (e.g., "weapon_ak47").
 */
export function GivePlayerItem(client: number, item: string): void {
	GetContext().GivePlayerItem(client, item);
}

/**
 * Removes an item/weapon from a player's inventory.
 *
 * @param client Client index.
 * @param item Item class name.
 */
export function RemovePlayerItem(client: number, item: string): void {
	GetContext().RemovePlayerItem(client, item);
}

/**
 * Gets the active weapon class name held by a client.
 *
 * @param client Client index.
 * @returns Weapon name.
 */
export function GetClientWeapon(client: number): string {
	return GetContext().GetClientWeapon(client);
}

/**
 * Sets the reserve or clip ammo for a specific weapon in the player's possession.
 *
 * @param client Client index.
 * @param weapon Weapon class name.
 * @param ammo Ammo amount.
 */
export function SetWeaponAmmo(
	client: number,
	weapon: string,
	ammo: number,
): void {
	GetContext().SetWeaponAmmo(client, weapon, ammo);
}

/**
 * Sets the gravity coefficient of a player entity.
 *
 * @param client Client index.
 * @param gravity Gravity scale (e.g. 1.0 is default, 0.5 is half gravity).
 */
export function SetEntityGravity(client: number, gravity: number): void {
	GetContext().SetEntityGravity(client, gravity);
}

/**
 * Sets the movement physics type of a player entity.
 *
 * @param client Client index.
 * @param movetype Movetype index/ID.
 */
export function SetEntityMoveType(client: number, movetype: number): void {
	GetContext().SetEntityMoveType(client, movetype);
}

/**
 * Sets a player's current health directly.
 *
 * @param client Client index.
 * @param health Health points.
 */
export function SetEntityHealth(client: number, health: number): void {
	GetContext().SetEntityHealth(client, health);
}

/**
 * Modifies the player model of a client.
 *
 * @param client Client index.
 * @param model Model path.
 */
export function SetEntityModel(client: number, model: string): void {
	GetContext().SetEntityModel(client, model);
}

/**
 * Sets the color rendering attributes (RGBA) of a player.
 *
 * @param client Client index.
 * @param r Red intensity (0-255).
 * @param g Green intensity (0-255).
 * @param b Blue intensity (0-255).
 * @param a Alpha/transparency intensity (0-255).
 */
export function SetEntityRenderColor(
	client: number,
	r: number,
	g: number,
	b: number,
	a: number,
): void {
	GetContext().SetEntityRenderColor(client, r, g, b, a);
}

/**
 * Emits an audio sound path exclusively to one client.
 *
 * @param client Client index.
 * @param soundPath Path to the sound file.
 */
export function EmitSoundToClient(
	client: number,
	soundPath: string,
	volume: number = 1.0,
	channel: number = 0,
	pitch: number = 100,
): void {
	GetContext().EmitSoundToClient(client, soundPath, volume, channel, pitch);
}

/**
 * Emits an audio sound path to all connected players.
 *
 * @param soundPath Path to the sound file.
 */
export function EmitSoundToAll(
	soundPath: string,
	volume: number = 1.0,
	channel: number = 0,
	pitch: number = 100,
): void {
	GetContext().EmitSoundToAll(soundPath, volume, channel, pitch);
}

/**
 * Checks if an admin client is permitted to target another target client based on immunity levels.
 * The server console (client 0) can target anyone. Players can always target themselves.
 *
 * @param admin Client index of the administrator.
 * @param target Client index of the target player.
 * @returns True if targeting is permitted, false otherwise.
 */
export function CanAdminTarget(admin: number, target: number): boolean {
	if (admin === 0) return true;
	if (admin === target) return true;

	if (
		!GetContext().IsClientInGame(admin) ||
		!GetContext().IsClientInGame(target)
	) {
		return false;
	}

	const adminSteamId = GetContext().GetClientAuthId(admin);
	const targetSteamId = GetContext().GetClientAuthId(target);
	return GetContext().adminManager.CanTarget(adminSteamId, targetSteamId);
}

/**
 * Processes a SourceMod-style target pattern string and returns matching client indices.
 *
 * Target patterns:
 * - "@all" or "*" -> All connected in-game players
 * - "@ct" -> Players on CT team (Team 3)
 * - "@t" -> Players on Terrorist team (Team 2)
 * - "@alive" -> Living players
 * - "@dead" -> Dead players
 * - "@me" -> The caller (adminClient)
 * - "!@me" or "@!me" -> All connected in-game players EXCEPT the caller
 * - "@bots" -> All bot players
 * - "@humans" -> All human players
 *
 * If no pattern matches the prefix '@' or '*', the function performs fallbacks:
 * 1. Checks if targetPattern is a valid 1-based client index (e.g. "3")
 * 2. Checks if targetPattern is a userid (with prefix '#', e.g. "#12")
 * 3. Checks if targetPattern matches exactly a player's name
 * 4. Checks if targetPattern matches partially a player's name (case-insensitive substring)
 *
 * @param adminClient The client index of the admin/caller initiating the targeting check.
 * @param targetPattern The targeting query/pattern.
 * @returns Array of matched client indices.
 */
export function ProcessTargetString(
	adminClient: number,
	targetPattern: string,
): number[] {
	return GetContext()
		.players.FindTargets(targetPattern, adminClient)
		.map((p) => p.index);
}

/**
 * Checks if a player is currently in observer/spectator mode.
 */
export function IsPlayerObserver(client: number): boolean {
	const p = GetContext().players.Get(client);
	return p ? p.IsObserver() : false;
}

/**
 * Gets the client index of the player being spectated.
 */
export function GetObserverTarget(client: number): number {
	const p = GetContext().players.Get(client);
	return p ? p.GetObserverTarget() : 0;
}

/**
 * Gets entity flags of a client.
 */
export function GetEntityFlags(client: number): number {
	const p = GetContext().players.Get(client);
	return p ? p.GetEntityFlags() : 0;
}

/**
 * Sets velocity vector for a client.
 */
export function SetEntityVelocity(
	client: number,
	x: number,
	y: number,
	z: number,
): void {
	const p = GetContext().players.Get(client);
	if (p) {
		p.SetVelocity(x, y, z);
	}
}

/**
 * Gets velocity vector of a client.
 */
export function GetEntityVelocity(client: number): {
	x: number;
	y: number;
	z: number;
} {
	const p = GetContext().players.Get(client);
	return p ? p.GetVelocity() : { x: 0, y: 0, z: 0 };
}

/**
 * Gets a client's clan tag.
 */
export function GetClientClanTag(client: number): string {
	return GetContext().GetClientClanTag(client);
}

/**
 * Sets a client's clan tag.
 */
export function SetClientClanTag(client: number, tag: string): void {
	GetContext().SetClientClanTag(client, tag);
}

/**
 * Checks if a client is a forced observer.
 */
export function IsClientForcedObserver(client: number): boolean {
	return GetContext().IsClientForcedObserver(client);
}

/**
 * Sets a client's forced observer state.
 */
export function SetClientForcedObserver(client: number, forced: boolean): void {
	GetContext().SetClientForcedObserver(client, forced);
}

/**
 * Prints a hint message to a client's HUD.
 *
 * @param client Client index.
 * @param message Hint message.
 */
export function PrintHintText(client: number, message: string): void {
	GetContext().PrintHintText(client, message);
}

/**
 * Executes a console command on a client's console.
 */
export function ClientCommand(client: number, cmd: string): void {
	GetContext().ClientCommand(client, cmd);
}
