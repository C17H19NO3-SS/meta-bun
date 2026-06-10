import { GetContext } from "../shared/context-store";
import type { ClientCookie, ConVar, SDKHookType } from "../shared/types/bridge";
import type { GameEvent } from "../shared/types/events";

export { Command, AdminCommand, Hook, HookEvent } from "../shared/decorators";
export { BasePlugin } from "../shared/plugin";
export { TaskRunner as Task } from "../shared/task";
export type { IGameBridge } from "../shared/types/bridge";
export {
	Action,
	Plugin_Changed,
	Plugin_Continue,
	Plugin_Handled,
	Plugin_Stop,
} from "../shared/types/enums";

export * from "./console";
export * from "./events";
export * from "./menus";
export * from "./player";
export * from "./timers";

/**
 * Log a message to the console and log files.
 *
 * @param message The message to log.
 */
export function LogMessage(message: string): void {
	GetContext().LogMessage(message);
}

/**
 * Prints a formatted message to a client's chat.
 *
 * @param client The client index.
 * @param message The chat message to display. Supports color tags like {Red}, {Green}.
 */
export function PrintToChat(client: number, message: string): void {
	GetContext().PrintToChat(client, message);
}

/**
 * Prints a formatted message to all active clients' chat.
 *
 * @param message The chat message to display to everyone. Supports color tags.
 */
export function PrintToChatAll(message: string): void {
	GetContext().PrintToChatAll(message);
}

/**
 * Replies to a client command. Prints to chat if called from a player client,
 * or logs to console if called from server console (client 0).
 *
 * @param client The client index.
 * @param message The reply message.
 */
export function ReplyToCommand(client: number, message: string): void {
	GetContext().ReplyToCommand(client, message);
}

/**
 * Prints a localized translation string to a client's chat.
 *
 * @param client The client index.
 * @param key The key of the translation.
 * @param args Interpolation arguments for the translation string.
 */
export function TPrintToChat(
	client: number,
	key: string,
	...args: unknown[]
): void {
	GetContext().TPrintToChat(client, key, ...args);
}

/**
 * Loads a translation file into the global translation system.
 *
 * @param filename Name of the translation file (e.g. "admin-tools.phrases").
 */
export function LoadTranslations(filename: string): void {
	GetContext().LoadTranslations(filename);
}

/**
 * Gets the maximum number of clients allowed on the server.
 *
 * @returns Maximum clients.
 */
export function GetMaxClients(): number {
	return GetContext().GetMaxClients();
}

/**
 * Gets the total count of connected clients.
 *
 * @param inGameOnly If true, only count fully connected in-game clients.
 * @returns Total count of clients.
 */
export function GetClientCount(inGameOnly: boolean = true): number {
	return GetContext().GetClientCount(inGameOnly);
}

/**
 * Dynamically creates/saves an admin to database/memory.
 */
export function CreateAdmin(
	steamid: string,
	flags: string,
	immunity: number = 0,
	expiresAt: number = 0,
): void {
	GetContext().adminManager.CreateAdmin(steamid, flags, immunity, expiresAt);
}

/**
 * Dynamically removes an admin from database/memory.
 */
export function RemoveAdmin(steamid: string): void {
	GetContext().adminManager.RemoveAdmin(steamid);
}

/**
 * Reloads admin configurations.
 */
export function ReloadAdmins(): void {
	GetContext().adminManager.ReloadAdmins();
}

/**
 * Dynamically registers an admin group.
 */
export function AddAdminGroup(
	groupName: string,
	flags: string,
	immunity: number = 0,
	inherit?: string,
): void {
	GetContext().adminManager.AddAdminGroup(groupName, flags, immunity, inherit);
}

/**
 * Logs a message to a specific file in the logs directory.
 *
 * @param filename Name of the file inside the logs/ directory.
 * @param message Message to log.
 */
export function LogToFile(filename: string, message: string): void {
	GetContext().LogToFile(filename, message);
}

/**
 * Logs an administrative action to a dedicated logs/admin.log file.
 *
 * @param admin Client index of the administrator.
 * @param target Client index of the target player (or <= 0/undefined for no target).
 * @param actionMessage Description of the action.
 */
export function LogAdminAction(
	admin: number,
	target: number | null | undefined,
	actionMessage: string,
): void {
	const adminName = admin === 0 ? "Console" : GetContext().GetClientName(admin);
	const adminAuth =
		admin === 0 ? "STEAM_ID_SERVER" : GetContext().GetClientAuthId(admin);
	const adminString = `"${adminName}<${admin}><${adminAuth}>"`;

	let targetName = "";
	let targetAuth = "";
	let logMsg = "";
	if (target && target > 0 && GetContext().IsClientInGame(target)) {
		targetName = GetContext().GetClientName(target);
		targetAuth = GetContext().GetClientAuthId(target);
		const targetString = `"${targetName}<${target}><${targetAuth}>"`;
		logMsg = `${adminString} targeted ${targetString} with action: ${actionMessage}`;
	} else {
		logMsg = `${adminString} executed action: ${actionMessage}`;
	}

	GetContext().LogToFile("admin.log", logMsg);
	GetContext().adminManager.LogAction(
		adminAuth,
		adminName,
		targetAuth,
		targetName,
		actionMessage,
	);
}

/**
 * Dynamically registers a command access flag override at runtime.
 *
 * @param command Command name (e.g. "sm_slap").
 * @param flags Permission flag string (e.g. "o").
 */
export function AddCommandOverride(command: string, flags: string): void {
	GetContext().adminManager.AddCommandOverride(command, flags);
}

/**
 * Dynamically removes a command access override at runtime.
 *
 * @param command Command name (e.g. "sm_slap").
 */
export function RemoveCommandOverride(command: string): void {
	GetContext().adminManager.RemoveCommandOverride(command);
}

/**
 * Creates or retrieves a console variable (ConVar).
 */
export function CreateConVar(
	name: string,
	defaultValue: string,
	description?: string,
): ConVar {
	return GetContext().CreateConVar(name, defaultValue, description);
}

/**
 * Finds an existing console variable (ConVar).
 */
export function FindConVar(name: string): ConVar | undefined {
	return GetContext().FindConVar(name);
}

/**
 * Asynchronously queries a console variable value from the engine.
 */
export function QueryConVar(name: string): Promise<string | null> {
	return GetContext().QueryConVar(name);
}

/**
 * Sets a console variable value (Bun-side or Engine-side).
 */
export function SetConVar(name: string, value: string): void {
	GetContext().SetConVar(name, value);
}

/**
 * Registers a client preference cookie.
 */
export function RegClientCookie(
	name: string,
	description: string,
): ClientCookie {
	return GetContext().RegClientCookie(name, description);
}

/**
 * Finds a client preference cookie.
 */
export function FindClientCookie(name: string): ClientCookie | undefined {
	return GetContext().FindClientCookie(name);
}

/**
 * Executes an asynchronous threaded SQL query.
 */
export function SQL_TQuery(sql: string, args?: unknown[]): Promise<unknown[]> {
	return GetContext().SQL_TQuery(sql, args);
}

/**
 * Hooks a game event in pre mode allowing blocking/interception.
 */
export function HookEventPre(
	event: string,
	callback: (data: GameEvent) => number,
): void {
	GetContext().HookEventPre(event, callback);
}

/**
 * Hooks low-level SDK client entity callbacks.
 */
export function SDKHook(
	client: number,
	hookType: SDKHookType,
	callback: (...args: unknown[]) => number,
): void {
	GetContext().SDKHook(client, hookType, callback);
}

/**
 * Unhooks low-level SDK client entity callbacks.
 */
export function SDKUnhook(
	client: number,
	hookType: SDKHookType,
	callback: (...args: unknown[]) => number,
): void {
	GetContext().SDKUnhook(client, hookType, callback);
}

/**
 * Gets the current server engine time in seconds.
 */
export function GetEngineTime(): number {
	return GetContext().GetEngineTime();
}

/**
 * Gets the server tickrate.
 */
export function GetTickrate(): number {
	return GetContext().GetTickrate();
}

/**
 * Gets the server tick interval duration.
 */
export function GetTickInterval(): number {
	return GetContext().GetTickInterval();
}

/**
 * Registers a shared API object under a unique service name.
 * Other plugins can query it synchronously or asynchronously.
 *
 * @param name Unique name for the API/service.
 * @param api The API object.
 */
export function RegisterAPI(name: string, api: Record<string, unknown>): void {
	GetContext().RegisterAPI(name, api);
}

/**
 * Check if a shared API is currently registered.
 *
 * @param name Unique name of the API.
 * @returns True if registered, false otherwise.
 */
export function HasAPI(name: string): boolean {
	return GetContext().HasAPI(name);
}

/**
 * Synchronously retrieves a proxy reference to a shared API.
 *
 * @param name Unique name of the API.
 * @returns The API proxy object.
 */
export function GetAPI(name: string): Record<string, unknown> {
	return GetContext().GetAPI(name);
}

/**
 * Asynchronously retrieves a proxy reference to a shared API, resolving when registered.
 *
 * @param name Unique name of the API.
 * @returns A promise resolving to the API proxy object.
 */
export function GetAPIAsync(name: string): Promise<Record<string, unknown>> {
	return GetContext().GetAPIAsync(name);
}

/**
 * Gets the current map name.
 */
export function GetCurrentMap(): string {
	return GetContext().GetCurrentMap();
}

/**
 * Gets the current bridge latency in milliseconds.
 */
export function GetBridgeLatency(): number {
	return GetContext().GetBridgeLatency();
}

/**
 * Gets a persisted state value.
 */
export function GetState<T>(key: string, initialValue: T): T {
	return GetContext().GetState(key, initialValue);
}

/**
 * Sets a persisted state value.
 */
export function SetState<T>(key: string, value: T): void {
	GetContext().SetState(key, value);
}
