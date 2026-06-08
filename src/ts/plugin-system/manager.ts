import { EventEmitter } from "node:events";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	watch,
} from "node:fs";
import { join, resolve } from "node:path";
import type { Bridge } from "../network/bridge";
import {
	commandSourceStore,
	pluginContextStore,
} from "../shared/context-store";
import type { DatabaseManager } from "../shared/database";
import { discordService } from "../shared/discord";
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
import { ReplySource } from "../shared/types/enums";
import type { GameEvent, PlayerChatEvent } from "../shared/types/events";
import type { IPlayerManager } from "../shared/types/player";
import type { IPlugin } from "../shared/types/plugin";
import { PluginContext } from "./context";
import { ConVar as ConVarImpl } from "./convar";
import { ClientCookie as ClientCookieImpl } from "./cookie";
import { Menu } from "./menu";

const COLOR_MAP: Record<string, string> = {
	"{Default}": "\x01",
	"{White}": "\x01",
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
	"{Orange}": "\x10",
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

interface CommandEntry {
	callback: CommandCallback;
	flags?: string | null;
	description?: string | null;
}

/**
 * Manages plugin loading, watch reloads, console commands registration, and event distribution.
 */
export class PluginManager extends EventEmitter implements IGameBridge {
	private pluginsFolder = resolve(process.cwd(), "plugins");
	private loadedPlugins: Map<
		string,
		{ plugin: IPlugin; context: PluginContext }
	> = new Map();
	private commands: Map<string, CommandEntry> = new Map();
	private watcher: ReturnType<typeof watch> | null = null;
	/** Tracks whether a vote is currently active to prevent concurrent votes. */
	public activeVote: boolean = false;
	public activeVoteTimer: Timer | null = null;
	private convars: Map<string, ConVar> = new Map();
	private bridgeLatency: number = 5;
	private cookies: Map<string, ClientCookie> = new Map();
	public preListeners: Map<string, Array<(data: GameEvent) => number>> =
		new Map();
	private sdkHooks: Map<
		number,
		Map<number, Array<(...args: unknown[]) => number>>
	> = new Map();
	private playerCommandTimestamps: Map<number, number> = new Map();
	private commandAliases: Map<string, string> = new Map();
	private sharedAPIs: Map<
		string,
		{ pluginName: string; api: Record<string, unknown> }
	> = new Map();
	private pendingAPIPromises: Map<string, Array<() => void>> = new Map();
	private consoleFilters: Array<(text: string) => string | null> = [];
	private currentMap: string = "";

	public PrintToServerConsole(message: string): void {
		console.log(message);
		this.bridge.Send({
			action: "print",
			message: message,
		});
	}

	/**
	 * Initializes the PluginManager.
	 */
	constructor(
		private bridge: Bridge,
		public readonly players: IPlayerManager,
		public readonly adminManager: IAdminManager,
		private enableWatcher: boolean = true,
		private getEngineTime?: () => number,
	) {
		super();

		// Dynamic event hooking to notify C++ Metamod bridge when a plugin needs an event
		this.on("newListener", (event: string | symbol) => {
			if (event === "newListener" || event === "removeListener") return;
			const eventStr = String(event);
			const count = this.listenerCount(eventStr);
			if (count === 0) {
				console.log(
					`[Plugin Manager] Dynamically hooking event in Metamod: ${eventStr}`,
				);
				this.bridge.Send({ action: "hook_event", event: eventStr });
			}
		});

		this.on("removeListener", (event: string | symbol) => {
			if (event === "newListener" || event === "removeListener") return;
			const eventStr = String(event);
			setTimeout(() => {
				const count = this.listenerCount(eventStr);
				if (count === 0) {
					console.log(
						`[Plugin Manager] Dynamically unhooking event in Metamod: ${eventStr}`,
					);
					this.bridge.Send({ action: "unhook_event", event: eventStr });
				}
			}, 0);
		});

		this.on("ConVarChanged", (data: any) => {
			if (data?.name && data.value !== undefined) {
				const cvar = this.convars.get(String(data.name));
				if (cvar) {
					(cvar as ConVarImpl).UpdateValueFromBridge(String(data.value));
				}
			}
		});

		if (this.enableWatcher) {
			this.SetupWatcher();
		}
		this.SetupCommandInterceptor();

		// Bind map lifecycle events to loaded plugins
		this.on("MapStart", (data: GameEvent) => {
			const mapData = data as unknown as { map: string };
			this.currentMap = mapData.map || "";
			for (const entry of this.loadedPlugins.values()) {
				const plugin = entry.plugin;
				if (typeof plugin.OnMapStart === "function") {
					plugin.OnMapStart(data);
				}
			}
		});

		this.on("MapEnd", (data: GameEvent) => {
			this.currentMap = "";
			for (const entry of this.loadedPlugins.values()) {
				const plugin = entry.plugin;
				if (typeof plugin.OnMapEnd === "function") {
					plugin.OnMapEnd(data);
				}
			}
		});

		// Register built-in meta-bun plugin management commands
		this.RegConsoleCmd(
			"meta-bun",
			(client, args) => {
				if (!args || args.length === 0) {
					this.ReplyToCommand(
						client,
						"{Green}[Meta-Bun]{Default} Kullanım: !meta-bun <list | load | unload | reload> [eklenti]",
					);
					return;
				}
				this.HandleMetaBunCommand(client, args).catch((err: Error) => {
					console.error("[Plugin Manager] Error in meta-bun command:", err);
				});
			},
			"z",
			"Meta-Bun eklenti yonetim sistemi",
		);

		this.RegConsoleCmd(
			"sm_help",
			(client, args) => {
				this.HandleHelpCommand(client, args);
			},
			null,
			"Yardim komutu - komut listesini gosterir",
		);

		this.RegConsoleCmdAlias("help", "sm_help");

		this.RegConsoleCmd(
			"sm_plugins",
			(client, args) => {
				this.HandlePluginsCommand(client, args);
			},
			"z",
			"Meta-Bun eklentillerini listeler",
		);

		this.RegConsoleCmd(
			"sm_reloadadmins",
			(client, _args) => {
				this.adminManager.ReloadAdmins();
				this.ReplyToCommand(
					client,
					"{Green}[Meta-Bun]{Default} Admin listesi ve yetkiler yeniden yuklendi.",
				);
			},
			"z",
			"Admin listesini yeniden yukler",
		);

		this.RegConsoleCmd(
			"sm_who",
			(client, args) => {
				this.HandleWhoCommand(client, args);
			},
			"b",
			"Oyundaki oyuncularin yetki durumlarini gosterir",
		);

		this.RegConsoleCmd(
			"sm_admins",
			(client, args) => {
				this.HandleAdminsCommand(client, args);
			},
			"z",
			"Sunucuda tanimli tum adminleri listeler",
		);

		this.RegConsoleCmd(
			"sm_fsay",
			(client, args) => {
				this.HandleFsayCommand(client, args);
			},
			"z",
			"Hedef oyuncu adina mesaj gonderir (Fake Say)",
		);

		// Auto ban sweeper every 5 minutes
		setInterval(() => this.SweepExpiredBans(), 5 * 60 * 1000);

		this.on("BridgeConnected", () => {
			console.log(
				"[Plugin Manager] Bridge connected. Synchronizing commands, convars, and hooks...",
			);

			// 1. Re-register all commands
			for (const [command, entry] of this.commands.entries()) {
				this.bridge.Send({
					action: "register_command",
					name: command,
					description: entry.description || "",
				});
			}

			// 2. Re-register all ConVars
			for (const [name, cvar] of this.convars.entries()) {
				this.bridge.Send({
					action: "cvar_register",
					name,
					defaultValue: cvar.GetString(),
					description: cvar.description,
				});
			}

			// 3. Re-register all event hooks
			for (const event of this.eventNames()) {
				const eventStr = String(event);
				if (
					eventStr !== "newListener" &&
					eventStr !== "removeListener" &&
					eventStr !== "BridgeConnected"
				) {
					console.log(`[Plugin Manager] Re-hooking event: ${eventStr}`);
					this.bridge.Send({ action: "hook_event", event: eventStr });
				}
			}

			// 4. Re-register all SDK hooks
			for (const [client, clientHooks] of this.sdkHooks.entries()) {
				for (const typeKey of clientHooks.keys()) {
					const hookType = typeKey as SDKHookType;
					console.log(
						`[Plugin Manager] Re-hooking SDK callback for client ${client}: type ${hookType}`,
					);
					this.bridge.Send({ action: "hook_sdk", client, type: hookType });
				}
			}
		});
	}

	private async HandleMetaBunCommand(
		client: number,
		args: string[],
	): Promise<void> {
		if (!args || args.length === 0 || args[0]?.toLowerCase() === "help") {
			this.ReplyToCommand(
				client,
				"{Green}[Meta-Bun]{Default} Kullanım: !meta-bun <list | load | unload | reload> [eklenti]",
			);
			return;
		}

		const subcommand = args[0]?.toLowerCase() || "";

		if (subcommand === "list") {
			if (!existsSync(this.pluginsFolder)) {
				this.ReplyToCommand(
					client,
					"{Green}[Meta-Bun]{Default} Eklenti klasörü bulunamadı.",
				);
				return;
			}

			const items = readdirSync(this.pluginsFolder, { withFileTypes: true });
			const list: string[] = [];
			for (const item of items) {
				const filename = item.name;
				if (item.isFile()) {
					if (
						(filename.endsWith(".ts") || filename.endsWith(".js")) &&
						!filename.endsWith(".d.ts")
					) {
						const loaded = this.loadedPlugins.get(filename);
						if (loaded) {
							list.push(
								`{Green}[Loaded]{Default} ${loaded.plugin.name} v${loaded.plugin.version || "1.0.0"} - ${loaded.plugin.author || "Unknown"} (${filename})`,
							);
						} else {
							list.push(`{Red}[Off]{Default} ${filename}`);
						}
					}
				} else if (item.isDirectory()) {
					const loaded = this.loadedPlugins.get(filename);
					if (loaded) {
						list.push(
							`{Green}[Loaded]{Default} ${loaded.plugin.name} v${loaded.plugin.version || "1.0.0"} - ${loaded.plugin.author || "Unknown"} (klasör: ${filename})`,
						);
					} else {
						list.push(`{Red}[Off]{Default} (klasör: ${filename})`);
					}
				}
			}

			this.ReplyToCommand(
				client,
				`{Gold}=== Meta-Bun Eklentileri (${list.length}) ==={Default}`,
			);
			for (const line of list) {
				this.ReplyToCommand(client, line);
			}
			return;
		}

		if (args.length < 2) {
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Default} Kullanım: !meta-bun ${subcommand} <eklenti_dosyasi_veya_klasoru>`,
			);
			return;
		}

		const targetName = args[1] || "";

		// Try to resolve the plugin file or folder from the partial/exact name
		let resolvedName: string | null = null;
		if (targetName && existsSync(resolve(this.pluginsFolder, targetName))) {
			resolvedName = targetName;
		} else if (targetName) {
			// Look for fuzzy matching
			const items = readdirSync(this.pluginsFolder);
			for (const item of items) {
				if (
					item === `${targetName}.ts` ||
					item === `${targetName}.js` ||
					item.toLowerCase() === targetName.toLowerCase()
				) {
					resolvedName = item;
					break;
				}
			}
		}

		if (!resolvedName) {
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti bulunamadı: ${targetName}`,
			);
			return;
		}

		if (subcommand === "load") {
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Default} Eklenti yükleniyor: ${resolvedName}...`,
			);
			await this.LoadPlugin(resolvedName);
			if (this.loadedPlugins.has(resolvedName)) {
				const loaded = this.loadedPlugins.get(resolvedName)!;
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Default} Eklenti başarıyla yüklendi: {LightBlue}${loaded.plugin.name}{Default} (${loaded.plugin.version})`,
				);
			} else {
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti yüklenemedi. Detaylar konsolda.`,
				);
			}
			return;
		}

		if (subcommand === "unload") {
			if (!this.loadedPlugins.has(resolvedName)) {
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti zaten yüklü değil: ${resolvedName}`,
				);
				return;
			}
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Default} Eklenti kaldırılıyor: ${resolvedName}...`,
			);
			await this.UnloadPlugin(resolvedName);
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Default} Eklenti başarıyla kaldırıldı.`,
			);
			return;
		}

		if (subcommand === "reload") {
			if (!this.loadedPlugins.has(resolvedName)) {
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Red} Hata:{Default} Yeniden yüklenecek eklenti bulunamadı veya yüklü değil: ${resolvedName}`,
				);
				return;
			}
			this.ReplyToCommand(
				client,
				`{Green}[Meta-Bun]{Default} Eklenti yeniden yükleniyor: ${resolvedName}...`,
			);
			await this.LoadPlugin(resolvedName);
			if (this.loadedPlugins.has(resolvedName)) {
				const loaded = this.loadedPlugins.get(resolvedName)!;
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Default} Eklenti başarıyla yeniden yüklendi: {LightBlue}${loaded.plugin.name}{Default} (${loaded.plugin.version})`,
				);
			} else {
				this.ReplyToCommand(
					client,
					`{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti yeniden yüklenirken hata oluştu.`,
				);
			}
			return;
		}
	}

	private HandleHelpCommand(client: number, args: string[]): void {
		const commandNames = Array.from(this.commands.keys()).sort();
		const totalCommands = commandNames.length;
		const pageSize = 10;
		const totalPages = Math.ceil(totalCommands / pageSize) || 1;

		let page = 1;
		if (args && args.length > 0 && args[0]) {
			const parsed = parseInt(args[0], 10);
			if (!Number.isNaN(parsed) && parsed > 0) {
				page = parsed;
			}
		}

		if (page > totalPages) {
			page = totalPages;
		}

		this.ReplyToCommand(
			client,
			`{Gold}=== Yardım (Sayfa ${page}/${totalPages}) ==={Default}`,
		);

		const startIdx = (page - 1) * pageSize;
		const endIdx = Math.min(startIdx + pageSize, totalCommands);
		const pageCommands = commandNames.slice(startIdx, endIdx);

		for (const cmdName of pageCommands) {
			const entry = this.commands.get(cmdName);
			const desc = entry?.description ? ` - ${entry.description}` : "";
			this.ReplyToCommand(client, `{Green}${cmdName}{Default}${desc}`);
		}
	}

	private HandlePluginsCommand(client: number, _args: string[]): void {
		this.ReplyToCommand(
			client,
			`{Gold}=== Meta-Bun Eklentileri (${this.loadedPlugins.size}) ==={Default}`,
		);
		let index = 1;
		for (const [filename, entry] of this.loadedPlugins.entries()) {
			const p = entry.plugin;
			const author = p.author ? ` by ${p.author}` : "";
			const version = p.version ? ` (${p.version})` : "";
			this.ReplyToCommand(
				client,
				`{Green}[${index.toString().padStart(2, "0")}]{Default} "${p.name}"${version}${author} - ${filename}`,
			);
			index++;
		}
	}

	private HandleWhoCommand(client: number, _args: string[]): void {
		const players = this.players.GetAll();
		this.ReplyToCommand(
			client,
			`{Gold}=== Aktif Oyuncular ve Yetkiler (${players.length}) ==={Default}`,
		);
		for (const p of players) {
			const flags = this.adminManager.GetFlags(p.steamId) || "Yetki Yok";
			const immunity = this.adminManager.GetImmunity(p.steamId);
			this.ReplyToCommand(
				client,
				`{Green}${p.name}{Default} (ID: ${p.index}) - Flags: {Yellow}${flags}{Default} (Immunity: ${immunity})`,
			);
		}
	}

	private HandleAdminsCommand(client: number, _args: string[]): void {
		const configPath = join(process.cwd(), "configs", "admins", "list.json");
		if (!existsSync(configPath)) {
			this.ReplyToCommand(
				client,
				"{Red}[Hata]{Default} Admin listesi dosyasi bulunamadi.",
			);
			return;
		}

		try {
			const content = readFileSync(configPath, "utf-8");
			const admins = JSON.parse(content);
			this.ReplyToCommand(
				client,
				`{Gold}=== Tanimli Admin Listesi ==={Default}`,
			);

			for (const [id, entry] of Object.entries(admins)) {
				let flags = "";
				let groups = "";
				if (typeof entry === "string") {
					flags = entry;
				} else {
					flags = (entry as any).flags || "";
					groups = (entry as any).groups
						? ` (Grup: ${(entry as any).groups.join(", ")})`
						: "";
				}
				this.ReplyToCommand(
					client,
					`{Green}${id}{Default} - Flags: {Yellow}${flags}{Default}${groups}`,
				);
			}
		} catch (_err) {
			this.ReplyToCommand(
				client,
				"{Red}[Hata]{Default} Admin listesi okunurken bir hata olustu.",
			);
		}
	}

	private HandleFsayCommand(client: number, args: string[]): void {
		if (args.length < 2) {
			this.ReplyToCommand(
				client,
				"{Yellow}Kullanim: {Default}sm_fsay <target> <mesaj>",
			);
			return;
		}

		const targetPattern = args[0]!;
		const message = args.slice(1).join(" ");

		// Simple target matching (by index or partial name)
		const players = this.players.GetAll();
		const target = players.find(
			(p) =>
				p.index.toString() === targetPattern ||
				p.name.toLowerCase().includes(targetPattern.toLowerCase()),
		);

		if (!target) {
			this.ReplyToCommand(
				client,
				`{Red}[Hata]{Default} '${targetPattern}' desenine uygun oyuncu bulunamadı.`,
			);
			return;
		}

		// Broadcast message as if target said it
		this.PrintToChatAll(`{Default}${target.name}: ${message}`);
		this.LogMessage(
			`[FSAY] ${target.name} (adına ${client} tarafından): ${message}`,
		);
	}

	/**
	 * Periodically sweeps expired bans from the database.
	 */
	public SweepExpiredBans(): void {
		const pm = this.players as unknown as {
			db: {
				GetAllBans: () => Array<{
					steamid: string;
					timestamp: number;
					duration: number;
				}>;
				RemoveBan: (steamid: string) => void;
			};
		};
		if (pm?.db) {
			try {
				const bans = pm.db.GetAllBans();
				const now = Date.now();
				let sweptCount = 0;
				for (const ban of bans) {
					if (ban.duration === 0) continue;
					const expiry = ban.timestamp + ban.duration * 60 * 1000;
					if (expiry <= now) {
						pm.db.RemoveBan(ban.steamid);
						sweptCount++;
					}
				}
				if (sweptCount > 0) {
					console.log(
						`[Plugin Manager] Expired ban sweeper: Swept and removed ${sweptCount} expired ban records.`,
					);
				}
			} catch (error) {
				console.error("[Plugin Manager] Error during ban sweeper run:", error);
			}
		}
	}

	/**
	 * Listens for chat events and intercepts chat triggers command executors.
	 */
	private SetupCommandInterceptor() {
		this.HookEventPre("PlayerChat", (data: GameEvent) => {
			const chatData = data as PlayerChatEvent;
			const player = this.players.Get(chatData.client);

			if (
				player &&
				(player as unknown as { IsGagged: () => boolean }).IsGagged()
			) {
				player.Say("You cannot send messages while your chat is gagged.");
				return 3; // Plugin_Handled
			}

			const text = chatData.text.trim();

			// Handle Admin Chat Colors
			if (player && !text.startsWith("!") && !text.startsWith("/")) {
				try {
					const chatColorsPath = resolve(
						process.cwd(),
						"configs",
						"admins",
						"chat_colors.json",
					);
					if (existsSync(chatColorsPath)) {
						const config = JSON.parse(readFileSync(chatColorsPath, "utf-8"));
						let roleConfig = null;

						// 1. Check for specific Player SteamID first
						if (config.players?.[player.steamId]) {
							roleConfig = config.players[player.steamId];
						}
						// 2. If not found, check player's groups
						else if (config.groups) {
							const playerGroups = this.adminManager.GetGroups(player.steamId);
							for (const groupName of playerGroups) {
								if (config.groups[groupName]) {
									roleConfig = config.groups[groupName];
									break; // Take the first matching group
								}
							}
						}

						if (roleConfig) {
							const tag = roleConfig.tag_text
								? `${roleConfig.tag_color || "{Default}"}${roleConfig.tag_text} `
								: "";
							const nameColor = roleConfig.name_color || "{Default}";
							const chatColor = roleConfig.chat_color || "{Default}";

							const formattedMessage = `${tag}${nameColor}${player.name}{Default}: ${chatColor}${text}`;

							// Block the original message and broadcast the formatted one
							this.PrintToChatAll(formattedMessage);
							return 3; // Plugin_Handled (Block engine chat)
						}
					}
				} catch (err) {
					console.error(
						"[Plugin Manager] Error processing admin chat colors:",
						err,
					);
				}
			}

			if (text.startsWith("!") || text.startsWith("/")) {
				const parts = text.split(/\s+/);
				const commandWithTrigger = parts[0];

				if (commandWithTrigger) {
					let commandName = commandWithTrigger.substring(1); // "ping" from "!ping"
					const args = parts.slice(1);

					if (this.commandAliases.has(commandName)) {
						commandName = this.commandAliases.get(commandName)!;
					}

					// SourceMod logic: Try finding "sm_" + commandName first
					const smCommandName = `sm_${commandName}`;
					let cmdEntry = this.commands.get(smCommandName);

					// Fallback to exact match (if someone registered without sm_ or typed !sm_ping)
					if (!cmdEntry) {
						cmdEntry = this.commands.get(commandName);
					}

					// Fallback to commandWithTrigger (if someone registered as "!ping")
					if (!cmdEntry) {
						cmdEntry = this.commands.get(commandWithTrigger);
					}

					if (cmdEntry) {
						const now = Date.now();
						const lastCalled =
							this.playerCommandTimestamps.get(chatData.client) || 0;
						if (
							Bun.env["NODE_ENV"] !== "test" &&
							chatData.client !== 0 &&
							now - lastCalled < 1000
						) {
							if (player) {
								player.Say("Please do not spam commands.");
							}
							return 3;
						}
						this.playerCommandTimestamps.set(chatData.client, now);

						// sv_cheats Check
						const cheatCommands = [
							"noclip",
							"god",
							"give",
							"sm_noclip",
							"sm_god",
							"sm_give",
						];
						const isCheat =
							cheatCommands.includes(commandName) ||
							cheatCommands.includes(smCommandName);
						if (isCheat) {
							const svCheats = this.FindConVar("sv_cheats");
							const cheatsEnabled = svCheats ? svCheats.GetInt() === 1 : false;
							if (!cheatsEnabled) {
								if (player) {
									player.Say("This command requires sv_cheats to be enabled.");
								}
								return 3;
							}
						}

						const { callback, flags } = cmdEntry;
						let flagsToCheck = flags;
						const overrideFlags =
							this.adminManager.GetCommandOverride(smCommandName) ??
							this.adminManager.GetCommandOverride(commandName);
						if (overrideFlags !== undefined) {
							flagsToCheck = overrideFlags || null;
						}

						if (chatData.client !== 0 && flagsToCheck) {
							const hasAccess = this.CheckCommandAccess(
								chatData.client,
								commandName,
								flagsToCheck,
							);
							if (!hasAccess) {
								const player = this.players.Get(chatData.client);
								if (player) {
									player.Say("Yetkiniz yok");
								} else {
									this.PrintToChat(chatData.client, "Yetkiniz yok");
								}
								return 3;
							}
						}

						commandSourceStore.run("chat", () => {
							try {
								const res = callback(chatData.client, args);
								if (res instanceof Promise) {
									res.catch((err: Error) => {
										console.error(
											`[Plugin Manager] Uncaught exception in async chat command "${commandName}":`,
											err,
										);
									});
								}
							} catch (err) {
								console.error(
									`[Plugin Manager] Uncaught exception in chat command "${commandName}":`,
									err,
								);
							}
						});
						return 3; // Block command text from chat
					}
				}
			}
			return 0; // Continue
		});

		this.HookEvent("ConsoleCommand", (data: GameEvent) => {
			const cmdData = data as unknown as {
				command: string;
				args: string[];
				client: number;
			};
			const commandName = cmdData.command;
			const args = cmdData.args || [];

			let resolvedCmd = commandName;
			if (this.commandAliases.has(resolvedCmd)) {
				resolvedCmd = this.commandAliases.get(resolvedCmd)!;
			}

			const smCommandName = resolvedCmd.startsWith("sm_")
				? resolvedCmd
				: `sm_${resolvedCmd}`;
			let cmdEntry = this.commands.get(smCommandName);
			if (!cmdEntry) {
				cmdEntry = this.commands.get(resolvedCmd);
			}

			if (cmdEntry) {
				const { callback, flags } = cmdEntry;
				let flagsToCheck = flags;
				const overrideFlags =
					this.adminManager.GetCommandOverride(smCommandName) ??
					this.adminManager.GetCommandOverride(resolvedCmd);
				if (overrideFlags !== undefined) {
					flagsToCheck = overrideFlags || null;
				}

				if (cmdData.client !== 0 && flagsToCheck) {
					const hasAccess = this.CheckCommandAccess(
						cmdData.client,
						resolvedCmd,
						flagsToCheck,
					);
					if (!hasAccess) {
						commandSourceStore.run("console", () => {
							this.ReplyToCommand(cmdData.client, "Yetkiniz yok");
						});
						return;
					}
				}

				commandSourceStore.run("console", () => {
					try {
						const res = callback(cmdData.client, args);
						if (res instanceof Promise) {
							res.catch((err: Error) => {
								console.error(
									`[Plugin Manager] Uncaught exception in async console command "${resolvedCmd}":`,
									err,
								);
							});
						}
					} catch (err) {
						console.error(
							`[Plugin Manager] Uncaught exception in console command "${resolvedCmd}":`,
							err,
						);
					}
				});
			}
		});
	}

	// --- IGameBridge Implementation ---

	// Core
	public HookEvent(event: string, callback: (data: GameEvent) => void): void {
		this.on(event, callback);
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
		this.commands.set(command, { callback, flags, description });
		console.log(
			`[Plugin Manager] Registered command: ${command}${flags ? ` [Flags: ${flags}]` : ""}${description ? ` (${description})` : ""}`,
		);
		this.bridge.Send({
			action: "register_command",
			name: command,
			description: description || "",
		});
	}

	public RegConsoleCmdAlias(alias: string, command: string): void {
		this.commandAliases.set(alias, command);
	}

	public AddConsoleFilter(filter: (text: string) => string | null): void {
		this.consoleFilters.push(filter);
	}

	public LogMessage(message: string): void {
		let msg: string | null = message;
		for (const filter of this.consoleFilters) {
			msg = filter(msg);
			if (msg === null) return;
		}

		// Standart framework ön eki ekle (eğer zaten yoksa)
		const prefix = "{Red}[Meta-Bun] {Default}";
		const fullMessage = msg.startsWith("[") ? msg : `${prefix}${msg}`;

		const ansiFormatted = ToAnsi(fullMessage);
		console.log(ansiFormatted);
	}

	public CreateTimer(
		ms: number,
		callback: () => void,
		repeat?: boolean,
	): Timer {
		return repeat ? setInterval(callback, ms) : setTimeout(callback, ms);
	}

	public KillTimer(timer: Timer): void {
		clearTimeout(timer);
		clearInterval(timer);
	}

	// Messaging
	public PrintToChat(client: number, message: string): void {
		if (commandSourceStore.getStore() === "console") {
			this.PrintToConsole(client, message);
			return;
		}
		let msg: string | null = message;
		for (const filter of this.consoleFilters) {
			msg = filter(msg);
			if (msg === null) return;
		}
		const formatted = FormatColorTags(msg);
		// Konsol logu için ham etiketli halini gönderiyoruz, LogMessage ANSI'ye çevirecek
		this.LogMessage(`[Chat -> ${client}] ${msg}`);
		this.bridge.Send({ action: "say", text: formatted });
	}

	public PrintToChatAll(message: string): void {
		let msg: string | null = message;
		for (const filter of this.consoleFilters) {
			msg = filter(msg);
			if (msg === null) return;
		}
		const formatted = FormatColorTags(msg);
		this.LogMessage(`[Chat -> ALL] ${msg}`);
		this.bridge.Send({ action: "say", text: formatted });
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

	public PrintHintText(client: number, message: string): void {
		this.bridge.Send({
			action: "hint",
			client: String(client),
			text: FormatColorTags(message),
		});
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
	public TPrintToChat(client: number, key: string, ...args: unknown[]): void {
		this.PrintToChat(client, `[T] ${key} ${args.join(" ")}`);
	}

	public LoadTranslations(filename: string): void {
		console.log(`[Plugin Manager] Loading translations from: ${filename}`);
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
		this.players.Get(client)?.SetTeam(team);
	}

	public RespawnPlayer(client: number): void {
		this.players.Get(client)?.Respawn();
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

	public CreateMenu(
		title: string,
		_callback: (client: number, info: string) => void,
	): IMenu {
		const menu = new Menu(this.bridge, title);
		return menu;
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

	public GetCurrentMap(): string {
		return this.currentMap;
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
		if (this.activeVote) {
			console.warn(
				"[Plugin Manager] A vote is already in progress. Cannot start another.",
			);
			return;
		}

		const results: Record<string, number> = {};
		for (const opt of options) {
			results[opt] = 0;
		}

		const players = this.players.GetInGameClients();
		if (players.length === 0) {
			// No players — resolve immediately without opening a vote
			callback(results);
			return;
		}

		this.activeVote = true;
		this.PrintToChatAll(`{Gold}Oylama Başladı: {Yellow}${question}`);

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

		this.activeVoteTimer = setTimeout(() => {
			this.activeVote = false;
			this.activeVoteTimer = null;

			let total = 0;
			for (const v of Object.values(results)) {
				total += v;
			}
			this.PrintToChatAll(`{Gold}Oylama Sonuçlandı: {Yellow}${question}`);
			for (const [opt, count] of Object.entries(results)) {
				const pct = total > 0 ? Math.round((count / total) * 100) : 0;
				this.PrintToChatAll(`{Green}${opt}: {Yellow}${count} oy (%${pct})`);
			}
			callback(results);
		}, durationMs);
	}

	public CancelVote(): boolean {
		if (!this.activeVote) return false;
		if (this.activeVoteTimer) {
			clearTimeout(this.activeVoteTimer);
			this.activeVoteTimer = null;
		}
		this.activeVote = false;
		// Notify metamod to clear active vote menu display on clients
		this.bridge.Send({ action: "command", cmd: "sm_cancelvote_engine" });
		console.log("[Plugin Manager] Active vote cancelled.");
		return true;
	}

	public IsVoteInProgress(): boolean {
		return this.activeVote;
	}

	// GeoIP / Ülke Tespit Sistemi
	public GetClientIP(client: number): string {
		return this.players.Get(client)?.GetIPAddress() ?? "127.0.0.1";
	}

	public GetClientCountry(client: number): string {
		return this.players.Get(client)?.GetCountry() ?? "Local / Unknown";
	}

	public LogToFile(filename: string, message: string): void {
		try {
			const fs = require("node:fs");
			const path = require("node:path");
			const logsDir = path.resolve(process.cwd(), "logs");
			if (!fs.existsSync(logsDir)) {
				fs.mkdirSync(logsDir, { recursive: true });
			}
			const logFilePath = path.join(logsDir, filename);

			// Log rotation check (> 5MB)
			if (fs.existsSync(logFilePath)) {
				const stats = fs.statSync(logFilePath);
				if (stats.size > 5 * 1024 * 1024) {
					const backupPath = `${logFilePath}.old`;
					if (fs.existsSync(backupPath)) {
						fs.unlinkSync(backupPath);
					}
					fs.renameSync(logFilePath, backupPath);
				}
			}

			const timestamp = new Date().toISOString();
			fs.appendFileSync(logFilePath, `[${timestamp}] [Core] ${message}\n`);
		} catch (e) {
			console.error("[LogToFile] Error writing log:", e);
		}
	}

	// Sunucu Performans & Latency Metrikleri
	public GetEngineTime(): number {
		return this.getEngineTime ? this.getEngineTime() : process.uptime();
	}

	public GetTickrate(): number {
		return 128;
	}

	public GetTickInterval(): number {
		return 1 / 128;
	}

	public SetBridgeLatency(latency: number): void {
		this.bridgeLatency = latency;
	}

	public GetBridgeLatency(): number {
		return this.bridgeLatency;
	}

	// --- End of IGameBridge Implementation ---

	/**
	 * Unregister a command.
	 */
	public UnregConsoleCmd(command: string): void {
		this.commands.delete(command);
		console.log(`[Plugin Manager] Unregistered command: ${command}`);
	}

	/**
	 * Loads or reloads a plugin from a file or folder.
	 */
	public async LoadPlugin(nameOrPath: string) {
		const fullPath = resolve(this.pluginsFolder, nameOrPath);

		// If the file/folder does not exist, unload and return (it was deleted)
		if (!existsSync(fullPath)) {
			if (this.loadedPlugins.has(nameOrPath)) {
				await this.UnloadPlugin(nameOrPath);
			}
			return;
		}

		let entryPoint = fullPath;
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			let found = false;

			// Priority 1: Check for index files in root or src/
			const priorityEntries = [
				"index.ts",
				"index.js",
				"src/index.ts",
				"src/index.js",
				"main.ts",
				"main.js",
			];

			for (const entry of priorityEntries) {
				const entryPath = resolve(fullPath, entry);
				if (existsSync(entryPath)) {
					entryPoint = entryPath;
					found = true;
					break;
				}
			}

			// Priority 2: Check package.json main field if not found via priority entries
			if (!found) {
				const pkgPath = resolve(fullPath, "package.json");
				if (existsSync(pkgPath)) {
					try {
						const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
						if (pkg.main) {
							const mainPath = resolve(fullPath, pkg.main);
							if (existsSync(mainPath)) {
								entryPoint = mainPath;
								found = true;
							}
						}
					} catch (e) {
						console.error(
							`[Plugin Manager] Error parsing package.json for ${nameOrPath}:`,
							e,
						);
					}
				}
			}

			if (!found) {
				console.error(
					`[Plugin Manager] Could not load folder plugin '${nameOrPath}': entry point (index/src/main) not found.`,
				);
				return;
			}
		}

		// If already loaded, unload it first
		if (this.loadedPlugins.has(nameOrPath)) {
			await this.UnloadPlugin(nameOrPath);
		}

		try {
			// Use cache-busting for hot-reload
			const modulePath = `${entryPoint}?update=${Date.now()}`;
			const pluginModule = await import(modulePath);
			const PluginClass = pluginModule.default;
			let pluginInstance: IPlugin;

			if (typeof PluginClass === "function") {
				// It's a class/constructor
				pluginInstance = new PluginClass();
			} else if (PluginClass) {
				// It's a plain object (fallback for existing plugins)
				pluginInstance = PluginClass;
			} else {
				// It's a functional/SourceMod style plugin (no default export)
				const name = nameOrPath.replace(/\.(ts|js)$/, "");
				pluginInstance = {
					name,
					version: "1.0.0",
					OnLoad: async (game) => {
						// Automatically bind exported functions as event hook listeners
						const reserved = new Set([
							"OnPluginStart",
							"OnPluginEnd",
							"default",
						]);
						for (const key of Object.keys(pluginModule)) {
							const exportVal = pluginModule[key];
							if (!reserved.has(key) && typeof exportVal === "function") {
								game.HookEvent(key, (data: GameEvent) => {
									exportVal(data);
								});
							}
						}

						if (typeof pluginModule.OnPluginStart === "function") {
							pluginModule.OnPluginStart();
						}
					},
					OnUnload: async () => {
						if (typeof pluginModule.OnPluginEnd === "function") {
							pluginModule.OnPluginEnd();
						}
					},
				};
			}

			if (!pluginInstance) {
				console.error(
					`[Plugin Manager] Invalid plugin format in ${nameOrPath}`,
				);
				return;
			}

			const pluginName =
				pluginInstance.name || nameOrPath.replace(/\.(ts|js)$/, "");
			const pluginVersion = pluginInstance.version || "1.0.0";

			const context = new PluginContext(
				pluginName,
				this,
				this.bridge,
				this.players,
				this.adminManager,
				{
					RegConsoleCmd: this.RegConsoleCmd.bind(this),
					UnregConsoleCmd: this.UnregConsoleCmd.bind(this),
				},
			);

			// Automatically register decorated commands and event hooks
			if (typeof PluginClass === "function") {
				const constructor = PluginClass as unknown as {
					__commands?: Array<{
						name: string;
						methodName: string;
						flags?: string;
						description?: string;
					}>;
					__eventHooks?: Array<{ eventName: string; methodName: string }>;
				};
				if (Array.isArray(constructor.__commands)) {
					for (const cmd of constructor.__commands) {
						context.RegConsoleCmd(
							cmd.name,
							(client, args) => {
								return pluginContextStore.run(context, () => {
									return (pluginInstance as any)[cmd.methodName]?.(
										client,
										args,
									);
								});
							},
							cmd.flags,
							cmd.description,
						);
						console.log(
							`[Plugin Manager] Registered decorated command ${cmd.name} to method ${cmd.methodName}`,
						);
					}
				}
				if (Array.isArray(constructor.__eventHooks)) {
					for (const hook of constructor.__eventHooks) {
						context.HookEvent(hook.eventName, (data: GameEvent) => {
							return pluginContextStore.run(context, () => {
								return (pluginInstance as any)[hook.methodName]?.(data);
							});
						});
						console.log(
							`[Plugin Manager] Hooked decorated event ${hook.eventName} to method ${hook.methodName}`,
						);
					}
				}
			}

			// Automatically register any "OnEventName" methods that are defined as functions on the class
			const prototype = Object.getPrototypeOf(pluginInstance) as Record<
				string,
				unknown
			>;
			const allKeys = new Set([
				...Object.getOwnPropertyNames(pluginInstance),
				...Object.getOwnPropertyNames(prototype || {}),
			]);

			for (const key of allKeys) {
				if (key.startsWith("On") && key !== "OnLoad" && key !== "OnUnload") {
					const val = (pluginInstance as unknown as Record<string, unknown>)[
						key
					];
					if (typeof val === "function") {
						const eventName = key.substring(2); // e.g. "PlayerChat" from "OnPlayerChat"
						context.HookEvent(eventName, (data: GameEvent) => {
							pluginContextStore.run(context, () =>
								(val as (data: GameEvent) => void).call(pluginInstance, data),
							);
						});
						console.log(
							`[Plugin Manager] Automatically hooked method ${key} to event: ${eventName}`,
						);
					}
				}
			}

			if (typeof pluginInstance.OnLoad === "function") {
				await pluginContextStore.run(context, () =>
					pluginInstance.OnLoad?.(context),
				);
			}

			this.loadedPlugins.set(nameOrPath, { plugin: pluginInstance, context });

			this.PrintToServerConsole(
				`[Plugin Manager] Loaded: ${pluginName} (${pluginVersion}) from ${nameOrPath}`,
			);
		} catch (error) {
			console.error(
				`[Plugin Manager] Failed to load plugin ${nameOrPath}:`,
				error,
			);
		}
	}

	/**
	 * Unloads a plugin.
	 */
	public async UnloadPlugin(nameOrPath: string) {
		const entry = this.loadedPlugins.get(nameOrPath);
		if (!entry) return;

		try {
			if (entry.plugin.OnUnload) {
				await pluginContextStore.run(entry.context, () =>
					entry.plugin.OnUnload?.(),
				);
			}
			entry.context.Cleanup();
			this.loadedPlugins.delete(nameOrPath);
			this.PrintToServerConsole(
				`[Plugin Manager] Unloaded: ${entry.plugin.name}`,
			);
		} catch (error) {
			console.error(
				`[Plugin Manager] Error unloading plugin ${nameOrPath}:`,
				error,
			);
		}
	}

	/**
	 * Loads all plugins in the plugins folder.
	 */
	public async LoadAllPlugins() {
		if (!existsSync(this.pluginsFolder)) {
			mkdirSync(this.pluginsFolder, { recursive: true });
		}

		const items = readdirSync(this.pluginsFolder, { withFileTypes: true });
		for (const item of items) {
			if (item.isFile()) {
				const file = item.name;
				if (
					(file.endsWith(".ts") || file.endsWith(".js")) &&
					!file.endsWith(".d.ts")
				) {
					await this.LoadPlugin(file);
				}
			} else if (item.isDirectory()) {
				const folder = item.name;
				await this.LoadPlugin(folder);
			}
		}
		this.PrintToServerConsole("[Plugin System] Plugin system is now active.");
	}

	/**
	 * Sets up a file watcher for the plugins folder.
	 */
	private SetupWatcher() {
		console.log(
			`[Plugin Manager] Watching for changes in: ${this.pluginsFolder}`,
		);
		this.watcher = watch(
			this.pluginsFolder,
			{ recursive: true },
			(_event, filename) => {
				if (!filename) return;
				if (filename.endsWith(".d.ts")) return;

				if (filename.endsWith(".ts") || filename.endsWith(".js")) {
					const parts = filename.split(/[/\\]/);
					const topLevelName = parts[0];
					if (!topLevelName) return;

					console.log(
						`[Plugin Manager] File changed: ${filename}. Reloading plugin ${topLevelName}...`,
					);
					// Small delay to ensure file is completely written
					setTimeout(() => {
						this.LoadPlugin(topLevelName).catch((err) => {
							console.error(
								`[Plugin Manager] Error reloading plugin ${topLevelName}:`,
								err,
							);
						});
					}, 100);
				}
			},
		);
	}

	/**
	 * Stops the file watcher and cleans up resources.
	 */
	public Stop() {
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
	}

	// --- State Retention / Hot-Reload ---
	private pluginStates: Map<string, Map<string, unknown>> = new Map();

	public GetState<T>(key: string, initialValue: T): T {
		return this.GetPluginState("global", key, initialValue);
	}

	public SetState<T>(key: string, value: T): void {
		this.SetPluginState("global", key, value);
	}

	public GetPluginState<T>(
		pluginName: string,
		key: string,
		initialValue: T,
	): T {
		if (!this.pluginStates.has(pluginName)) {
			this.pluginStates.set(pluginName, new Map());
		}
		const states = this.pluginStates.get(pluginName)!;
		if (!states.has(key)) {
			states.set(key, initialValue);
		}
		return states.get(key) as T;
	}

	public SetPluginState<T>(pluginName: string, key: string, value: T): void {
		if (!this.pluginStates.has(pluginName)) {
			this.pluginStates.set(pluginName, new Map());
		}
		const states = this.pluginStates.get(pluginName)!;
		states.set(key, value);
	}

	// --- ConVar System ---
	public CreateConVar(
		name: string,
		defaultValue: string,
		description?: string,
	): ConVar {
		if (this.convars.has(name)) {
			return this.convars.get(name)!;
		}
		const cvar = new ConVarImpl(
			name,
			defaultValue,
			description,
			(cname, cval) => {
				this.bridge.Send({ action: "cvar_set", name: cname, value: cval });
			},
		);
		this.convars.set(name, cvar);
		this.bridge.Send({
			action: "cvar_register",
			name,
			defaultValue,
			description: description || "",
		});
		return cvar;
	}

	public FindConVar(name: string): ConVar | undefined {
		return this.convars.get(name);
	}

	// --- ClientPrefs / Cookie System ---
	public RegClientCookie(name: string, description: string): ClientCookie {
		if (this.cookies.has(name)) {
			return this.cookies.get(name)!;
		}
		const pm = this.players as unknown as { db: DatabaseManager };
		const cookie = new ClientCookieImpl(name, description, pm.db);
		this.cookies.set(name, cookie);
		return cookie;
	}

	public FindClientCookie(name: string): ClientCookie | undefined {
		return this.cookies.get(name);
	}

	// --- Asynchronous Database API ---
	public async SQL_TQuery(
		sql: string,
		args: unknown[] = [],
	): Promise<unknown[]> {
		const pm = this.players as unknown as { db: DatabaseManager };
		if (!pm.db) {
			throw new Error("Database not connected.");
		}
		return new Promise((resolve, reject) => {
			queueMicrotask(() => {
				try {
					const query = pm.db.prepare(sql);
					const rows = query.all(...(args as any[]));
					resolve(rows);
				} catch (error) {
					reject(error);
				}
			});
		});
	}

	// --- Pre-hooking & Interception ---
	public HookEventPre(
		event: string,
		callback: (data: GameEvent) => number,
	): void {
		const eventStr = String(event);
		if (!this.preListeners.has(eventStr)) {
			this.preListeners.set(eventStr, []);
			console.log(`[Plugin Manager] Hooking pre-event in Metamod: ${eventStr}`);
			this.bridge.Send({ action: "hook_event", event: eventStr });
		}
		this.preListeners.get(eventStr)?.push(callback);
	}

	public UnhookEventPre(
		event: string,
		callback: (data: GameEvent) => number,
	): void {
		const eventStr = String(event);
		const list = this.preListeners.get(eventStr);
		if (list) {
			const idx = list.indexOf(callback);
			if (idx !== -1) {
				list.splice(idx, 1);
			}
			if (list.length === 0) {
				this.preListeners.delete(eventStr);
				console.log(
					`[Plugin Manager] Unhooking pre-event in Metamod: ${eventStr}`,
				);
				this.bridge.Send({ action: "unhook_event", event: eventStr });
			}
		}
	}

	public override emit(event: string | symbol, ...args: unknown[]): boolean {
		const eventStr = String(event);
		const preList = this.preListeners.get(eventStr);
		if (preList && preList.length > 0) {
			const data = args[0] as GameEvent;
			for (const listener of preList) {
				try {
					const result = listener(data);
					if (result === 3 || result === 4) {
						// Plugin_Handled (3) / Plugin_Stop (4)
						console.log(
							`[Plugin Manager] Event ${eventStr} intercepted and BLOCKED by pre-hook.`,
						);
						return false;
					}
				} catch (e) {
					console.error(
						`[Plugin Manager] Error in pre-listener for event ${eventStr}:`,
						e,
					);
				}
			}
		}
		return super.emit(event, ...args);
	}

	// --- SDK Hooks ---
	public SDKHook(
		client: number,
		hookType: SDKHookType,
		callback: (...args: unknown[]) => number,
	): void {
		if (!this.sdkHooks.has(client)) {
			this.sdkHooks.set(client, new Map());
		}
		const clientHooks = this.sdkHooks.get(client)!;
		const typeKey = hookType as number;
		if (!clientHooks.has(typeKey)) {
			clientHooks.set(typeKey, []);
			console.log(
				`[Plugin Manager] Hooking SDK callback for client ${client}: type ${hookType}`,
			);
			this.bridge.Send({ action: "hook_sdk", client, type: hookType });
		}
		clientHooks.get(typeKey)?.push(callback);
	}

	public SDKUnhook(
		client: number,
		hookType: SDKHookType,
		callback: (...args: unknown[]) => number,
	): void {
		const clientHooks = this.sdkHooks.get(client);
		if (!clientHooks) return;
		const typeKey = hookType as number;
		const callbacks = clientHooks.get(typeKey);
		if (!callbacks) return;

		const idx = callbacks.indexOf(callback);
		if (idx !== -1) {
			callbacks.splice(idx, 1);
		}

		if (callbacks.length === 0) {
			clientHooks.delete(typeKey);
			console.log(
				`[Plugin Manager] Unhooking SDK callback for client ${client}: type ${hookType}`,
			);
			this.bridge.Send({ action: "unhook_sdk", client, type: hookType });
		}
		if (clientHooks.size === 0) {
			this.sdkHooks.delete(client);
		}
	}

	public TriggerSDKHook(
		client: number,
		hookType: SDKHookType,
		...args: unknown[]
	): number {
		const clientHooks = this.sdkHooks.get(client);
		if (!clientHooks) return 0;
		const callbacks = clientHooks.get(hookType as number);
		if (!callbacks) return 0;

		for (const cb of callbacks) {
			try {
				const res = cb(...args);
				if (res !== 0) {
					return res;
				}
			} catch (e) {
				console.error(
					`[Plugin Manager] Error in SDK hook ${hookType} for client ${client}:`,
					e,
				);
			}
		}
		return 0;
	}

	public RegisterAPI(
		name: string,
		api: Record<string, unknown>,
		pluginName: string = "core",
	): void {
		if (this.sharedAPIs.has(name)) {
			console.warn(
				`[Plugin Manager] Shared API '${name}' is already registered and will be overwritten.`,
			);
		}
		this.sharedAPIs.set(name, { pluginName, api });
		console.log(
			`[Plugin Manager] Shared API registered: ${name} (from plugin: ${pluginName})`,
		);

		const pending = this.pendingAPIPromises.get(name);
		if (pending) {
			for (const resolveFn of pending) {
				try {
					resolveFn();
				} catch (err) {
					console.error(
						`[Plugin Manager] Error resolving pending API promise for '${name}':`,
						err,
					);
				}
			}
			this.pendingAPIPromises.delete(name);
		}
	}

	public UnregisterAPI(name: string): void {
		const entry = this.sharedAPIs.get(name);
		if (entry) {
			this.sharedAPIs.delete(name);
			console.log(
				`[Plugin Manager] Shared API unregistered: ${name} (from plugin: ${entry.pluginName})`,
			);
		}
	}

	public HasAPI(name: string): boolean {
		return this.sharedAPIs.has(name);
	}

	public GetAPI(name: string): Record<string, unknown> {
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					const entry = this.sharedAPIs.get(name);
					if (!entry) {
						throw new Error(
							`[MetaBun] Shared API '${name}' is not registered or has been unloaded.`,
						);
					}
					const val = entry.api[prop as string];
					if (typeof val === "function") {
						return val.bind(entry.api);
					}
					return val;
				},
				set: (_target, prop, value) => {
					const entry = this.sharedAPIs.get(name);
					if (!entry) {
						throw new Error(
							`[MetaBun] Shared API '${name}' is not registered or has been unloaded.`,
						);
					}
					entry.api[prop as string] = value;
					return true;
				},
				has: (_target, prop) => {
					const entry = this.sharedAPIs.get(name);
					return entry ? prop in entry.api : false;
				},
			},
		) as Record<string, unknown>;
	}

	public async GetAPIAsync(name: string): Promise<Record<string, unknown>> {
		if (this.HasAPI(name)) {
			return this.GetAPI(name);
		}
		return new Promise<Record<string, unknown>>((resolve) => {
			if (!this.pendingAPIPromises.has(name)) {
				this.pendingAPIPromises.set(name, []);
			}
			this.pendingAPIPromises.get(name)?.push(() => {
				resolve(this.GetAPI(name));
			});
		});
	}

	public async Discord_SendMessage(
		channelId: string,
		content: string | object,
	): Promise<boolean> {
		const context = pluginContextStore.getStore();
		const pluginName = context ? context.pluginName : "core";
		return discordService.SendMessage(pluginName, channelId, content);
	}
}
