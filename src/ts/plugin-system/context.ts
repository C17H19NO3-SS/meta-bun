import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Bridge } from "../network/bridge";
import {
	commandSourceStore,
	pluginContextStore,
} from "../shared/context-store";
import { translationManager } from "../shared/translations";
import type { IAdminManager } from "../shared/types/admin";
import type {
	ClientCookie,
	CommandCallback,
	ConVar,
	IGameBridge,
	IMenu,
	SDKHookType,
	Timer,
} from "../shared/types/bridge";
import {
	Plugin_Handled,
	Plugin_Stop,
	ReplySource,
	type Team,
} from "../shared/types/enums";
import type { GameEvent } from "../shared/types/events";
import type { IPlayerManager } from "../shared/types/player";
import type { IPluginManager } from "../shared/types/plugin";
import { Menu } from "./menu";

const COLOR_MAP: Record<string, string> = {
	"{Default}": "\x01",
	"{Red}": "\x02",
	"{LightRed}": "\x03",
	"{Green}": "\x04",
	"{Lime}": "\x05",
	"{LightGreen}": "\x06",
	"{DarkRed}": "\x07",
	"{Grey}": "\x08",
	"{Yellow}": "\x09",
	"{Gold}": "\x0A",
	"{Blue}": "\x0B",
	"{DarkBlue}": "\x0C",
	"{Purple}": "\x0E",
	"{Magenta}": "\x0F",
	"{Cyan}": "\x10",
};

const ANSI_COLOR_MAP: Record<string, string> = {
	"\x01": "\x1b[0m", // Default (Reset)
	"\x02": "\x1b[31m", // Red
	"\x03": "\x1b[91m", // Light Red
	"\x04": "\x1b[32m", // Green
	"\x05": "\x1b[92m", // Lime
	"\x06": "\x1b[92m", // Light Green
	"\x07": "\x1b[31m", // Dark Red
	"\x08": "\x1b[90m", // Grey
	"\x09": "\x1b[93m", // Yellow
	"\x0A": "\x1b[33m", // Gold
	"\x0B": "\x1b[34m", // Blue
	"\x0C": "\x1b[94m", // Dark Blue
	"\x0E": "\x1b[35m", // Purple
	"\x0F": "\x1b[95m", // Magenta
	"\x10": "\x1b[38;5;208m", // Orange/Cyan
};

/**
 * Format custom chat color tags into game color codes.
 *
 * @param message Chat message to format.
 */
function FormatColorTags(message: string): string {
	let formatted = message;
	for (const [tag, code] of Object.entries(COLOR_MAP)) {
		formatted = formatted.replaceAll(tag, code);
	}
	return formatted;
}

/**
 * Converts game color codes to ANSI escape sequences for terminal display.
 */
function ToAnsi(message: string): string {
	let formatted = message;
	for (const [code, ansi] of Object.entries(ANSI_COLOR_MAP)) {
		formatted = formatted.replaceAll(code, ansi);
	}
	return `${formatted}\x1b[0m`; // Ensure reset at end
}

/**
 * PluginContext provides a scoped, isolated API to each loaded plugin.
 * Tracks all listeners, timers, commands, and menu callbacks so they can
 * be fully cleaned up when the plugin is unloaded or hot-reloaded.
 */
export class PluginContext implements IGameBridge {
	private listeners: Array<{
		event: string;
		callback: (data: GameEvent) => void;
	}> = [];
	private timers: Set<Timer> = new Set();
	private commands: Set<string> = new Set();
	/**
	 * Map of menu UUID → callback, cleared on Cleanup() to prevent memory leaks.
	 */
	private menuCallbacks: Map<string, (client: number, info: string) => void> =
		new Map();
	private preListeners: Array<{
		event: string;
		callback: (data: GameEvent) => number;
	}> = [];
	private sdkHooks: Array<{
		client: number;
		hookType: SDKHookType;
		callback: (...args: unknown[]) => number;
	}> = [];
	private registeredAPIs: Set<string> = new Set();

	/**
	 * Initializes the PluginContext and registers the MenuSelect event listener
	 * through the tracked listeners array so it is properly cleaned up on unload.
	 */
	constructor(
		public pluginName: string,
		private pluginManager: IPluginManager,
		private bridge: Bridge,
		public readonly players: IPlayerManager,
		public readonly adminManager: IAdminManager,
		private commandRegistry: {
			RegConsoleCmd: (
				command: string,
				callback: CommandCallback,
				flags?: string | null,
				description?: string | null,
			) => void;
			UnregConsoleCmd: (command: string) => void;
		},
	) {
		// Track the MenuSelect listener through the standard listeners array
		// so it is removed automatically during Cleanup().
		const menuSelectHandler = (data: GameEvent) => {
			const anyData = data as unknown as {
				menuId: string;
				client: number;
				info: string;
			};
			const menu = this.menus.get(anyData.menuId);
			if (menu) {
				// Handle pagination internally
				if (menu.HandleInternalNavigation(anyData.client, anyData.info)) {
					return;
				}

				const callback = this.menuCallbacks.get(anyData.menuId);
				if (callback) {
					pluginContextStore.run(this, () =>
						callback(anyData.client, anyData.info),
					);
				}
			}
		};
		this.listeners.push({ event: "MenuSelect", callback: menuSelectHandler });
		this.pluginManager.on("MenuSelect", menuSelectHandler);
	}

	// --- IGameBridge Implementation ---

	// Core
	public HookEvent(event: string, callback: (data: GameEvent) => void): void {
		const wrappedCallback = (data: GameEvent) => {
			pluginContextStore.run(this, () => callback(data));
		};
		this.listeners.push({ event, callback: wrappedCallback });
		this.pluginManager.on(event, wrappedCallback);
	}

	public ServerCommand(cmd: string): void {
		this.bridge.Send({ action: "command", cmd });
	}

	public RegConsoleCmd(
		command: string,
		callback: CommandCallback,
		flags?: string | null,
		description?: string | null,
	): void {
		const wrappedCallback = (client: number, args: string[]) => {
			pluginContextStore.run(this, () => callback(client, args));
		};
		this.commands.add(command);
		this.commandRegistry.RegConsoleCmd(
			command,
			wrappedCallback,
			flags,
			description,
		);
	}

	private menus: Map<string, Menu> = new Map();

	public CreateMenu(
		title: string,
		callback: (client: number, info: string) => void,
	): IMenu {
		const menu = new Menu(this.bridge, title);
		this.menus.set(menu.GetId(), menu);
		const wrappedCallback = (client: number, info: string) => {
			pluginContextStore.run(this, () => callback(client, info));
		};
		this.menuCallbacks.set(menu.GetId(), wrappedCallback);
		return menu;
	}

	public LogMessage(
		message: string,
		type: "info" | "success" | "error" | "warn" | "debug" = "info",
	): void {
		// Theme Colors
		const prefix = `{Red}[${this.pluginName}]{Default} `;
		let typeColor = "{White}";

		switch (type) {
			case "success":
				typeColor = "{Green}";
				break;
			case "error":
				typeColor = "{Red}";
				break;
			case "warn":
			case "debug":
				typeColor = "{Yellow}";
				break;
			default:
				typeColor = "{White}";
		}

		const fullMessage = `${prefix}${typeColor}${message}`;
		const formatted = FormatColorTags(fullMessage);
		const ansiFormatted = ToAnsi(formatted);
		console.log(ansiFormatted);
	}

	public PrintToServerConsole(message: string): void {
		this.pluginManager.PrintToServerConsole(message);
	}

	public PrintHintText(client: number, message: string): void {
		this.pluginManager.PrintHintText(client, message);
	}

	public IsVoteInProgress(): boolean {
		return this.pluginManager.IsVoteInProgress();
	}

	public CreateTimer(
		ms: number,
		callback: () => unknown,
		repeat?: boolean,
	): Timer {
		let timer: Timer;
		const wrappedCallback = () => {
			const result = pluginContextStore.run(this, () => callback());
			if (result === Plugin_Stop || result === Plugin_Handled) {
				this.KillTimer(timer);
			}
		};
		timer = repeat
			? setInterval(wrappedCallback, ms)
			: setTimeout(() => {
					this.timers.delete(timer);
					pluginContextStore.run(this, () => callback());
				}, ms);

		this.timers.add(timer);
		return timer;
	}

	public KillTimer(timer: Timer): void {
		clearTimeout(timer);
		clearInterval(timer);
		this.timers.delete(timer);
	}

	// Messaging
	public PrintToChat(client: number, message: string): void {
		if (commandSourceStore.getStore() === "console") {
			this.PrintToConsole(client, message);
			return;
		}
		const formattedMessage = FormatColorTags(message);
		if (client === 0) {
			this.PrintToChatAll(formattedMessage);
			return;
		}
		const p = this.players.Get(client);
		if (p) {
			p.Say(formattedMessage);
		}
	}

	public PrintToChatAll(message: string): void {
		this.bridge.Send({ action: "say", text: FormatColorTags(message) });
	}

	public PrintToConsole(client: number, message: string): void {
		const formatted = FormatColorTags(message);
		if (client === 0) {
			this.LogMessage(formatted);
		} else {
			const escaped = formatted.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
			this.bridge.Send({
				action: "client_command",
				client: String(client),
				cmd: `echo "${escaped}"`,
			});
		}
	}

	public ReplyToCommand(client: number, message: string): void {
		const formattedMessage = FormatColorTags(message);
		if (commandSourceStore.getStore() === "console" || client === 0) {
			this.PrintToConsole(client, formattedMessage);
		} else {
			this.PrintToChat(client, formattedMessage);
		}
	}

	public GetCmdReplySource(): ReplySource {
		return commandSourceStore.getStore() === "chat"
			? ReplySource.Chat
			: ReplySource.Console;
	}

	public RegisterAPI(name: string, api: Record<string, unknown>): void {
		this.pluginManager.RegisterAPI(name, api, this.pluginName);
		this.registeredAPIs.add(name);
	}

	public HasAPI(name: string): boolean {
		return this.pluginManager.HasAPI(name);
	}

	public GetAPI(name: string): Record<string, unknown> {
		return this.pluginManager.GetAPI(name);
	}

	public GetAPIAsync(name: string): Promise<Record<string, unknown>> {
		return this.pluginManager.GetAPIAsync(name);
	}

	public TPrintToChat(client: number, key: string, ...args: unknown[]): void {
		const p = this.players.Get(client);
		const lang = p?.GetLanguage() ?? "en";
		const raw = translationManager.GetTranslation(this.pluginName, key, lang);
		const formatted = translationManager.Format(raw, ...args);
		this.PrintToChat(client, formatted);
	}

	public LoadTranslations(filename: string): void {
		translationManager.LoadTranslations(filename);
	}

	// Client Info & Stats
	public GetMaxClients(): number {
		return 32;
	}

	public GetClientCount(_inGameOnly: boolean = true): number {
		return this.players.GetAll().length;
	}

	public GetClientName(client: number): string {
		return this.players.Get(client)?.name ?? "Unknown";
	}

	public GetClientAuthId(client: number): string {
		return this.players.Get(client)?.steamId ?? "ID_PENDING";
	}

	public GetClientUserId(client: number): number {
		return this.players.Get(client)?.userId ?? 0;
	}

	public GetClientHealth(client: number): number {
		return this.players.Get(client)?.GetHealth() ?? 0;
	}

	public GetClientMoney(client: number): number {
		return this.players.Get(client)?.GetMoney() ?? 0;
	}

	public GetClientTeam(client: number): number {
		return this.players.Get(client)?.GetTeam() ?? 0;
	}

	public IsClientInGame(client: number): boolean {
		return this.players.Get(client) !== undefined;
	}

	public IsPlayerAlive(client: number): boolean {
		return this.players.Get(client)?.IsAlive() ?? false;
	}

	// Actions
	public SlapPlayer(client: number, damage: number): void {
		this.players.Get(client)?.Slap(damage);
	}

	public TeleportEntity(client: number, x: number, y: number, z: number): void {
		this.players.Get(client)?.Teleport(x, y, z);
	}

	public ChangeClientTeam(client: number, team: number): void {
		this.players.Get(client)?.SetTeam(team as Team);
	}

	public RespawnPlayer(client: number): void {
		this.players.Get(client)?.Respawn();
	}

	public GivePlayerItem(client: number, item: string): void {
		this.bridge.Send({ action: "give_item", client: client.toString(), item });
	}

	public RemovePlayerItem(client: number, item: string): void {
		this.bridge.Send({
			action: "remove_item",
			client: client.toString(),
			item,
		});
	}

	public GetClientWeapon(client: number): string {
		return this.players.Get(client)?.GetWeapon() ?? "";
	}

	public SetWeaponAmmo(client: number, weapon: string, ammo: number): void {
		this.bridge.Send({
			action: "set_ammo",
			client: client.toString(),
			weapon,
			ammo: ammo.toString(),
		});
	}

	public SetEntityGravity(client: number, gravity: number): void {
		this.players.Get(client)?.SetGravity(gravity);
	}

	public SetEntityMoveType(client: number, movetype: number): void {
		this.players.Get(client)?.SetMoveType(movetype);
	}

	public SetEntityHealth(client: number, health: number): void {
		this.players.Get(client)?.SetHealth(health);
	}

	public SetEntityModel(client: number, model: string): void {
		this.players.Get(client)?.SetModel(model);
	}

	public SetEntityRenderColor(
		client: number,
		r: number,
		g: number,
		b: number,
		a: number,
	): void {
		this.players.Get(client)?.SetRenderColor(r, g, b, a);
	}

	public EmitSoundToClient(
		client: number,
		soundPath: string,
		volume?: number,
		channel?: number,
		pitch?: number,
	): void {
		this.players.Get(client)?.EmitSound(soundPath, volume, channel, pitch);
	}

	public EmitSoundToAll(
		soundPath: string,
		volume?: number,
		channel?: number,
		pitch?: number,
	): void {
		const payload: any = {
			action: "play_sound",
			sound: soundPath,
			all: "true",
		};
		if (volume !== undefined) payload.volume = volume.toString();
		if (channel !== undefined) payload.channel = channel.toString();
		if (pitch !== undefined) payload.pitch = pitch.toString();
		this.bridge.Send(payload);
	}

	public KickClient(client: number, reason?: string): void {
		this.players.Get(client)?.Kick(reason);
	}

	public BanClient(
		steamId: string,
		reason: string,
		adminSteamId: string,
		duration: number,
		ip: string = "",
	): void {
		this.bridge.Send({
			action: "ban",
			steamid: steamId,
			duration: duration.toString(),
			reason,
			admin: adminSteamId,
			ip,
		});
	}

	public RemoveBan(steamId: string): void {
		this.bridge.Send({ action: "unban", steamid: steamId });
	}

	// Permissions
	public CheckCommandAccess(
		client: number,
		_command: string,
		flags: string,
	): boolean {
		const player = this.players.Get(client);
		if (!player) return false;
		return this.adminManager.HasPermission(player.steamId, flags);
	}

	public GetUserFlagBits(client: number): string {
		const player = this.players.Get(client);
		if (!player) return "";
		return this.adminManager.GetFlags(player.steamId);
	}

	// Voting System
	public CreateVote(
		question: string,
		options: string[],
		callback: (results: Record<string, number>) => void,
		durationMs: number = 10000,
	): void {
		if (this.pluginManager.IsVoteInProgress()) {
			console.warn(
				"[Plugin Context] A vote is already in progress. Cannot start another.",
			);
			return;
		}

		const results: Record<string, number> = {};
		for (const opt of options) {
			results[opt] = 0;
		}

		const players = this.players.GetInGameClients();
		if (players.length === 0) {
			callback(results);
			return;
		}

		const menu = this.CreateMenu(question, (_client, info) => {
			if (results[info] !== undefined) {
				results[info]++;
			}
		});

		for (const opt of options) {
			menu.AddItem(opt, opt);
		}

		for (const p of players) {
			menu.Display(p.index);
		}

		setTimeout(() => {
			callback(results);
		}, durationMs);
	}

	public CancelVote(): boolean {
		return this.pluginManager.CancelVote();
	}

	// GeoIP / Country Lookup
	public GetClientIP(client: number): string {
		return this.players.Get(client)?.GetIPAddress() ?? "127.0.0.1";
	}

	public GetClientCountry(client: number): string {
		return this.players.Get(client)?.GetCountry() ?? "Local / Unknown";
	}

	// File Logging — uses native node:fs imports (no require())
	public LogToFile(filename: string, message: string): void {
		try {
			const logsDir = resolve(process.cwd(), "logs");
			if (!existsSync(logsDir)) {
				mkdirSync(logsDir, { recursive: true });
			}
			const logFilePath = join(logsDir, filename);
			const timestamp = new Date().toISOString();
			appendFileSync(
				logFilePath,
				`[${timestamp}] [${this.pluginName}] ${message}\n`,
			);
		} catch (e) {
			console.error("[LogToFile] Error writing log:", e);
		}
	}

	// Engine Metrics — delegates to PluginManager for tick-accurate engine time
	public GetCurrentMap(): string {
		return this.pluginManager.GetCurrentMap();
	}

	public GetEngineTime(): number {
		return this.pluginManager.GetEngineTime();
	}

	public GetTickrate(): number {
		return 128;
	}

	public GetTickInterval(): number {
		return 1 / 128;
	}

	public GetBridgeLatency(): number {
		return this.pluginManager.GetBridgeLatency();
	}

	// State Retention / Hot-Reload
	public GetState<T>(key: string, initialValue: T): T {
		return this.pluginManager.GetPluginState(
			this.pluginName,
			key,
			initialValue,
		);
	}

	public SetState<T>(key: string, value: T): void {
		this.pluginManager.SetPluginState(this.pluginName, key, value);
	}

	// ConVar System
	public CreateConVar(
		name: string,
		defaultValue: string,
		description?: string,
	): ConVar {
		return this.pluginManager.CreateConVar(name, defaultValue, description);
	}

	public FindConVar(name: string): ConVar | undefined {
		return this.pluginManager.FindConVar(name);
	}

	// ClientPrefs / Cookie System
	public RegClientCookie(name: string, description: string): ClientCookie {
		return this.pluginManager.RegClientCookie(name, description);
	}

	public FindClientCookie(name: string): ClientCookie | undefined {
		return this.pluginManager.FindClientCookie(name);
	}

	// Asynchronous Database API
	public async SQL_TQuery(
		sql: string,
		args: unknown[] = [],
	): Promise<unknown[]> {
		return this.pluginManager.SQL_TQuery(sql, args);
	}

	// Discord
	public async Discord_SendMessage(
		channelId: string,
		content: string | object,
	): Promise<boolean> {
		return this.pluginManager.Discord_SendMessage(channelId, content);
	}

	// Pre-hooking & Interception
	public HookEventPre(
		event: string,
		callback: (data: GameEvent) => number,
	): void {
		const wrappedCallback = (data: GameEvent) => {
			return pluginContextStore.run(this, () => callback(data));
		};
		this.preListeners.push({ event, callback: wrappedCallback });
		this.pluginManager.HookEventPre(event, wrappedCallback);
	}

	// SDK Hooks
	public SDKHook(
		client: number,
		hookType: SDKHookType,
		callback: (...args: unknown[]) => number,
	): void {
		const wrappedCallback = (...args: unknown[]) => {
			return pluginContextStore.run(this, () => callback(...args));
		};
		this.sdkHooks.push({ client, hookType, callback: wrappedCallback });
		this.pluginManager.SDKHook(client, hookType, wrappedCallback);
	}

	public SDKUnhook(
		client: number,
		hookType: SDKHookType,
		_callback: (...args: unknown[]) => number,
	): void {
		const idx = this.sdkHooks.findIndex(
			(h) => h.client === client && h.hookType === hookType,
		);
		if (idx !== -1) {
			const entry = this.sdkHooks[idx]!;
			this.sdkHooks.splice(idx, 1);
			this.pluginManager.SDKUnhook(client, hookType, entry.callback);
		}
	}

	public GetClientClanTag(client: number): string {
		const p = this.players.Get(client);
		return p ? p.GetClanTag() : "";
	}

	public SetClientClanTag(client: number, tag: string): void {
		const p = this.players.Get(client);
		if (p) p.SetClanTag(tag);
	}

	public IsClientForcedObserver(client: number): boolean {
		const p = this.players.Get(client);
		return p ? p.IsForcedObserver() : false;
	}

	public SetClientForcedObserver(client: number, forced: boolean): void {
		const p = this.players.Get(client);
		if (p) p.SetForcedObserver(forced);
	}

	public ClientCommand(client: number, cmd: string): void {
		this.bridge.Send({
			action: "client_command",
			client: client.toString(),
			cmd,
		});
	}

	/**
	 * Cleans up all resources used by this plugin context:
	 * - Removes all registered event listeners (including MenuSelect)
	 * - Kills all active timers
	 * - Unregisters all console commands
	 * - Clears all menu callbacks to prevent memory leaks
	 */
	public Cleanup(): void {
		this.LogMessage("Kaynaklar temizleniyor...", "debug");

		// Remove all tracked event listeners
		for (const { event, callback } of this.listeners) {
			this.pluginManager.removeListener(event, callback);
		}
		this.listeners = [];

		// Remove preListeners from PluginManager
		for (const { event, callback } of this.preListeners) {
			this.pluginManager.UnhookEventPre(event, callback);
		}
		this.preListeners = [];

		// Remove sdkHooks from PluginManager
		for (const { client, hookType, callback } of this.sdkHooks) {
			this.pluginManager.SDKUnhook(client, hookType, callback);
		}
		this.sdkHooks = [];

		// Kill all active timers
		for (const timer of this.timers) {
			clearTimeout(timer);
			clearInterval(timer);
		}
		this.timers.clear();

		// Unregister all console commands
		for (const command of this.commands) {
			this.commandRegistry.UnregConsoleCmd(command);
		}
		this.commands.clear();

		// Clear menu callbacks to release references and prevent leaks
		this.menuCallbacks.clear();

		// Unregister all shared APIs registered by this plugin
		for (const name of this.registeredAPIs) {
			this.pluginManager.UnregisterAPI(name);
		}
		this.registeredAPIs.clear();

		this.LogMessage("Temizlik tamamlandi.", "debug");
	}
}
