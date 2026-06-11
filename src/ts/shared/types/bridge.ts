import type { Socket } from "bun";
import type { ReplySource } from "./enums";
import type { MessageMiddlewareHandler } from "./message";

/**
 * GameAction format sent over the C++ Metamod bridge.
 */
export interface GameAction {
	action: "dump_schema" | string;
	[key: string]: string | number | boolean | undefined;
}

/**
 * Socket type connecting Bun to Metamod C++.
 */
export type BunSocket = Socket<unknown>;

/**
 * Supported bridge serialization protocols.
 */
export type BridgeProtocol =
	| "ndjson"
	| "length_prefixed_json"
	| "length_prefixed_msgpack";

/**
 * Represents a single timer instance.
 */
export type Timer = any;

/**
 * Callback function for console commands.
 */
export type CommandCallback = (
	client: number,
	args: string[],
) => void | Promise<void>;

/**
 * SDK Hook Callback decision return values.
 */
export enum SDKHookAction {
	Continue = 0,
	Handled = 3,
	Stop = 4,
}

/**
 * Supported SDK Hook types (from SourceMod).
 */
export enum SDKHookType {
	OnTakeDamage = 1,
	WeaponCanUse = 2,
	TraceAttack = 3,
	PreThink = 4,
	PostThink = 5,
	OnEntityCreated = 6,
	OnEntityDeleted = 7,
	Touch = 8,
}

/**
 * Options for registering a console command.
 */
export interface CommandOptions {
	description?: string | null;
	flags?: number | string | null;
	silent?: boolean;
}

/**
 * Interface for the global game engine bridge.
 * Provides access to server functions, events, and client management.
 */
export interface IGameBridge {
	/** Prints a message to the server's standard console. */
	PrintToServerConsole(message: string): void | Promise<void>;

	/** Prints a message to a client's chat or all clients if 0. */
	PrintToChat(client: number, message: string): void | Promise<void>;

	/** Prints a message to all clients' chat. */
	PrintToChatAll(message: string): void | Promise<void>;

	/** Prints a message to a client's console. */
	PrintToConsole(client: number, message: string): void | Promise<void>;

	/** Prints a hint message to a client's HUD. */
	PrintHintText(client: number, message: string): void | Promise<void>;

	/** Register a callback for an engine event. */
	HookEvent<K extends keyof EventMap>(
		event: K,
		callback: (data: EventMap[K]) => void,
	): void;
	HookEvent(event: string, callback: (data: any) => void): void;

	/** Registers a new console command. */
	RegConsoleCmd(
		command: string,
		callback: CommandCallback,
		options?: CommandOptions | string | null,
		description?: string | null,
	): void;

	/** Responds to a command based on whether it was sent from chat or console. */
	ReplyToCommand(client: number, message: string): void | Promise<void>;

	/** Gets the current command reply source (chat or console). */
	GetCmdReplySource(): ReplySource;

	/** Multi-language chat print (simulated). */
	TPrintToChat(
		client: number,
		key: string,
		...args: unknown[]
	): void | Promise<void>;

	/** Loads a translation file from the translations folder. */
	LoadTranslations(filename: string): void;

	// Client Info & Stats
	/** Gets the maximum number of clients allowed on the server. */
	GetMaxClients(): number;
	/** Gets the number of currently connected clients. */
	GetClientCount(inGameOnly?: boolean): number;
	/** Gets the nickname of a client. */
	GetClientName(client: number): string;
	/** Gets the SteamID (AuthID) of a client. */
	GetClientAuthId(client: number): string;
	/** Gets the unique UserId of a client. */
	GetClientUserId(client: number): number;
	/** Gets the health of a client. */
	GetClientHealth(client: number): number;
	/** Gets the current money of a client. */
	GetClientMoney(client: number): number;
	/** Gets the team index of a client. */
	GetClientTeam(client: number): number;
	/** Checks if a client is fully connected and in-game. */
	IsClientInGame(client: number): boolean;
	/** Checks if a client is currently alive. */
	IsPlayerAlive(client: number): boolean;

	// Actions
	/** Slaps a player, applying optional damage. */
	SlapPlayer(client: number, damage: number): void;
	/** Teleports an entity to specific world coordinates. */
	TeleportEntity(client: number, x: number, y: number, z: number): void;
	/** Changes a client's team index. */
	ChangeClientTeam(client: number, team: number): void;
	/** Respawns a dead player. */
	RespawnPlayer(client: number): void;
	/** Kicks a client from the server. */
	KickClient(client: number, reason?: string): void;
	/** Bans a client from the server. */
	BanClient(
		steamId: string,
		reason: string,
		adminSteamId: string,
		duration: number,
		ip?: string,
	): void;
	/** Removes a ban from a client. */
	RemoveBan(steamId: string): void;
	/** Gives an item (weapon/equipment) to a player. */
	GivePlayerItem(client: number, item: string): void;
	/** Removes an item (weapon/equipment) from a player. */
	RemovePlayerItem(client: number, item: string): void;
	/** Gets the name of the weapon currently held by a client. */
	GetClientWeapon(client: number): string;
	/** Sets the primary ammo (clip) of a weapon for a client. */
	SetWeaponAmmo(client: number, weapon: string, ammo: number): void;
	/** Creates a custom menu for a client. */
	CreateMenu(
		title: string,
		callback: (client: number, info: string) => void,
	): IMenu;
	/** Set gravity multiplier for an entity. */
	SetEntityGravity(client: number, gravity: number): void;
	/** Set move type (e.g. noclip) for an entity. */
	SetEntityMoveType(client: number, movetype: number): void;
	/** Set health for an entity. */
	SetEntityHealth(client: number, health: number): void;
	/** Set character model for an entity. */
	SetEntityModel(client: number, model: string): void;
	/** Set render color and transparency for an entity. */
	SetEntityRenderColor(
		client: number,
		r: number,
		g: number,
		b: number,
		a: number,
	): void;
	/** Emit a sound to a specific client. */
	EmitSoundToClient(
		client: number,
		soundPath: string,
		volume?: number,
		channel?: number,
		pitch?: number,
	): void;
	/** Emit a sound to all connected clients. */
	EmitSoundToAll(
		soundPath: string,
		volume?: number,
		channel?: number,
		pitch?: number,
	): void;

	// Engine Depth
	/** Finds all entities within a specific radius of a location. */
	GetEntitiesInRadius(origin: { x: number; y: number; z: number }, radius: number): Promise<number[]>;
	/** Finds the first entity with a specific classname. */
	FindEntityByClassname(classname: string): Promise<number>;
	/** Sends a high-level JSON object as a Protobuf message to the engine. */
	SendProtobuf(msgName: string, data: Record<string, unknown>): void;

	// Permissions
	/** Checks if a client has specific admin permission flags. */
	CheckCommandAccess(client: number, command: string, flags: string): boolean;
	/** Gets the raw admin flag bits string for a client. */
	GetUserFlagBits(client: number): string;

	// Voting
	/** Starts a server-wide vote. */
	CreateVote(
		question: string,
		options: string[],
		callback: (results: Record<string, number>) => void,
		durationMs?: number,
	): void;
	/** Cancels any active vote. */
	CancelVote(): boolean;
	/** Checks if a vote is currently in progress. */
	IsVoteInProgress(): boolean;

	// State Retention
	/** Gets a persisted state value (useful for hot-reloads). */
	GetState<T>(key: string, initialValue: T): T;
	/** Sets a persisted state value. */
	SetState<T>(key: string, value: T): void;

	// ConVar System
	/** Creates or finds a console variable. */
	CreateConVar(
		name: string,
		defaultValue: string,
		description?: string,
	): ConVar;
	/** Finds an existing console variable (Bun-side). */
	FindConVar(name: string): ConVar | undefined;
	/** Asynchronously queries a console variable value from the engine. */
	QueryConVar(name: string): Promise<string | null>;
	/** Sets a console variable value (Bun-side or Engine-side). */
	SetConVar(name: string, value: string): void;

	// Cookie System
	/** Registers a persistent client cookie (ClientPrefs). */
	RegClientCookie(name: string, description: string): ClientCookie;
	/** Finds a registered client cookie. */
	FindClientCookie(name: string): ClientCookie | undefined;

	// Database API
	/** Executes an asynchronous SQL query using the main plugin database. */
	SQL_TQuery(sql: string, args?: unknown[]): Promise<unknown[]>;

	// Message Pipeline
	/** Registers a middleware to intercept and modify messages. */
	RegisterMessageMiddleware(
		handler: MessageMiddlewareHandler,
		priority?: number,
	): void;

	// Cross-plugin API
	/** Registers a shared API object that other plugins can access. */
	RegisterAPI(name: string, api: Record<string, unknown>): void;
	/** Gets a shared API object from another plugin. */
	GetAPI(name: string): Record<string, unknown>;
	/** Asynchronously gets a shared API object (waits for registration if needed). */
	GetAPIAsync(name: string): Promise<Record<string, unknown>>;

	// Discord
	/** Sends a message to a Discord channel via the bot (requires permission). */
	Discord_SendMessage(
		channelId: string,
		content: string | object,
	): Promise<boolean>;

	// Interception
	/** Register a pre-hook callback for an engine event. Returning HANDLED blocks the event. */
	HookEventPre<K extends keyof EventMap>(
		event: K,
		callback: (data: EventMap[K]) => number,
	): void;
	HookEventPre(event: string, callback: (data: any) => number): void;

	// SDK Hooks
	/** Hooks a motor-level SDK callback (e.g. OnTakeDamage). */
	SDKHook(
		client: number,
		hookType: SDKHookType,
		callback: (...args: unknown[]) => number,
	): void;
	/** Unhooks a previously registered SDK callback. */
	SDKUnhook(
		client: number,
		hookType: SDKHookType,
		callback: (...args: unknown[]) => number,
	): void;

	// Meta
	/** Gets the current map name. */
	GetCurrentMap(): string;
	/** Gets the current engine uptime in seconds. */
	GetEngineTime(): number;
	/** Gets the simulated tickrate (e.g. 128). */
	GetTickrate(): number;
	/** Gets the duration of a single tick in seconds. */
	GetTickInterval(): number;
	/** Gets the current bridge latency in milliseconds. */
	GetBridgeLatency(): number;
}

/**
 * Interface representing a custom menu that can be displayed to clients.
 */
export interface IMenu {
	/** Sets the title displayed at the top of the menu. */
	SetTitle(title: string): void;
	/** Adds a selectable item to the menu. */
	AddItem(info: string, display: string): void;
	/** Displays the menu to a specific client. */
	Display(client: number, time?: number): void;
}

/**
 * Represents a single item in a menu.
 */
export interface MenuItem {
	info: string;
	display: string;
}

/**
 * Interface representing a console variable (ConVar).
 */
export interface ConVar {
	readonly name: string;
	readonly description: string;
	GetName(): string;
	GetFloat(): number;
	GetInt(): number;
	GetString(): string;
	SetFloat(value: number): void;
	SetInt(value: number): void;
	SetString(value: string): void;
	/** Adds a hook triggered whenever the ConVar value changes. */
	AddChangeHook(
		callback: (cvar: ConVar, oldValue: string, newValue: string) => void,
	): void;
}

/**
 * Interface representing a persistent client cookie.
 */
export interface ClientCookie {
	/** Gets the cookie value for a client. */
	Get(client: number): string;
	/** Sets the cookie value for a client. */
	Set(client: number, value: string): void;
}
