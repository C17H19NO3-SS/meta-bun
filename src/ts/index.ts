import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decode } from "@msgpack/msgpack";
import { BanManager } from "./admins/bans";
import { AdminManager } from "./admins/manager";
import { Bridge } from "./network/bridge";
import { PlayerManager } from "./players/manager";
import { Player } from "./players/player";
import { PluginManager } from "./plugin-system/manager";
import { DashboardServer } from "./addons/dashboard/server";
import { GatewayServer } from "./addons/gateway/websocket";
import { UpdaterService } from "./addons/updater/service";
import { NavMesh } from "./addons/ai/navmesh";
import { DatabaseManager } from "./shared/database";
import { discordService } from "./shared/discord";
import { BridgeError } from "./shared/errors";
import type { BridgeProtocol, BunSocket } from "./shared/types/bridge";
import type {
	AuthEvent,
	BridgeLatencyUpdateEvent,
	GameEvent,
	PingEvent,
	PlayerConnectEvent,
	PlayerDisconnectEvent,
	PlayerStatsUpdateEvent,
} from "./shared/types/events";
import type { SteamProfile } from "./shared/types/player";
import { SteamIdTo64 } from "./shared/utils";

/**
 * Main application class coordinates the socket listeners, plugin system manager,
 * and game state databases.
 */
export class MetaBunApp {
	private bridge: Bridge;
	private pluginManager: PluginManager;
	private playerManager: PlayerManager;
	private adminManager: AdminManager;
	private banManager: BanManager;
	private dbManager: DatabaseManager;
	private navMesh: NavMesh;
	private socketBuffers: Map<BunSocket, Buffer> = new Map();
	private authenticatedSockets: Set<BunSocket> = new Set();
	private protocol: BridgeProtocol = "ndjson";
	private server: any = null;
	private clientSocket: BunSocket | null = null;
	private rconServer: any = null;
	private dashboardServer: DashboardServer | null = null;
	private gatewayServer: GatewayServer | null = null;
	private updaterService: UpdaterService | null = null;
	private debug = false;

	// Tickrate system properties (128 tickrate)
	private tickIntervalMs = 1000 / 128; // 7.8125 ms
	private currentTick = 0;
	private engineTime = 0;
	private isTickLoopRunning = false;
	private nextTickTime = 0;
	private tickTimeout: any = null;
	private settings: any = {};

	/**
	 * Initializes the MetaBunApp application.
	 *
	 * @param port Socket port to listen on for C++ bridge connections.
	 */
	constructor(private port: number) {
		this.bridge = new Bridge();
		this.dbManager = new DatabaseManager();
		this.adminManager = new AdminManager(this.dbManager);
		this.banManager = new BanManager(this.dbManager);
		// Pass the shared DatabaseManager so PlayerManager and BanManager
		// both operate on the same SQLite connection.
		this.playerManager = new PlayerManager(this.dbManager, false);
		this.playerManager.InitializeConsole(
			this.bridge,
			this.adminManager,
			this.banManager,
		);
		this.pluginManager = new PluginManager(
			this.bridge,
			this.playerManager,
			this.adminManager,
			true,
			this.GetEngineTime.bind(this),
		);

		this.navMesh = new NavMesh();

		this.LoadSettings();

		this.debug = this.settings.bridge?.debug || false;
		this.bridge.EnableDebug(this.debug);

		this.protocol =
			Bun.env["BRIDGE_PROTOCOL"] || this.settings.bridge?.protocol || "ndjson";
		this.bridge.SetProtocol(this.protocol as BridgeProtocol);

		// Expose bridge globally for SchemaGen proxy classes
		(globalThis as any).Bridge = this.bridge;
	}

	private LoadSettings(): void {
		const configPath = join(process.cwd(), "configs", "core", "settings.json");
		if (existsSync(configPath)) {
			try {
				this.settings = JSON.parse(readFileSync(configPath, "utf-8"));
				this.updaterService = new UpdaterService(this.pluginManager, this.settings);
				if (this.pluginManager) {
					this.pluginManager.LogMessage(
						"Merkezi ayarlar yuklendi: configs/core/settings.json",
						"success",
					);
				}
			} catch (err) {
				if (this.pluginManager) {
					this.pluginManager.LogMessage(
						`Hata: settings.json yuklenemedi: ${err}`,
						"error",
					);
				} else {
					console.error(`[MetaBun] Error loading settings.json: ${err}`);
				}
			}
		}
	}

	private async ConnectToBridge(): Promise<void> {
		const bridgeToken = Bun.env["BRIDGE_TOKEN"] || this.settings.bridge?.token;

		while (true) {
			try {
				this.pluginManager.LogMessage(
					`Metamod C++ bridge baglaniliyor (127.0.0.1:${this.port})...`,
					"info",
				);

				const socket = await Bun.connect({
					hostname: "127.0.0.1",
					port: this.port,
					socket: {
						open: (socket) => {
							const bunSocket = socket as BunSocket;
							this.clientSocket = bunSocket;
							this.socketBuffers.set(bunSocket, Buffer.alloc(0));

							if (!bridgeToken) {
								this.pluginManager.LogMessage(
									"Metamod C++ bridge baglandi (Yetki gerekmiyor).",
									"success",
								);
								this.authenticatedSockets.add(bunSocket);
								this.bridge.SetSocket(bunSocket);
								this.pluginManager.emit("BridgeConnected");
							} else {
								this.pluginManager.LogMessage(
									"Metamod C++ bridge baglandi. Yetki gonderiliyor...",
									"info",
								);
								// Send auth action
								this.bridge.SetSocket(bunSocket);
								this.bridge.Send({ action: "auth", token: bridgeToken });
							}
						},
						data: (socket, data) => {
							const bunSocket = socket as BunSocket;
							let buffer = this.socketBuffers.get(bunSocket) || Buffer.alloc(0);
							buffer = Buffer.concat([buffer, data]);

							// Length prefixed framing (now mandatory)
							while (buffer.length >= 4) {
								const length = buffer.readUInt32BE(0);
								if (buffer.length >= 4 + length) {
									const payloadBuffer = buffer.subarray(4, 4 + length);
									buffer = buffer.subarray(4 + length);
									try {
										let payload: GameEvent;
										if (this.protocol === "length_prefixed_json") {
											payload = JSON.parse(
												payloadBuffer.toString("utf-8"),
											) as GameEvent;
										} else {
											payload = decode(payloadBuffer) as GameEvent;
										}

										if (
											bridgeToken &&
											!this.authenticatedSockets.has(bunSocket)
										) {
											const authPayload = payload as any;
											if (
												payload.event === "auth_success" ||
												authPayload.action === "auth_success"
											) {
												this.pluginManager.LogMessage(
													"Metamod C++ bridge yetkilendirildi.",
													"success",
												);
												this.authenticatedSockets.add(bunSocket);
												this.pluginManager.emit("BridgeConnected");
											} else if (
												payload.event === "auth_failed" ||
												authPayload.action === "auth_failed"
											) {
												this.pluginManager.LogMessage(
													"Bridge yetkilendirme basarisiz. Yanlis token.",
													"error",
												);
												bunSocket.close();
											}
											continue;
										}
										this.HandlePayload(payload);
									} catch (err) {
										this.pluginManager.LogMessage(
											`MsgPack parse hatasi: ${err}`,
											"error",
										);
									}
								} else break;
							}
							this.socketBuffers.set(bunSocket, buffer);
						},
						close: () => {
							this.pluginManager.LogMessage(
								"Metamod C++ bridge ayrildi.",
								"warn",
							);
							this.clientSocket = null;
							this.authenticatedSockets.clear();
							this.bridge.SetSocket(null);
						},
						error: (_socket, error) => {
							this.pluginManager.LogMessage(
								`Bridge soket hatasi: ${error}`,
								"error",
							);
						},
					},
				});

				// Keep connection alive or wait for close
				break;
			} catch (e) {
				// Retry after 2 seconds
				await new Promise((r) => setTimeout(r, 2000));
			}
		}

		// Start Dashboard Server
		const dashboardSettings = this.settings.dashboard;
		if (dashboardSettings?.port) {
			this.dashboardServer = new DashboardServer(
				dashboardSettings.port,
				dashboardSettings.password,
				this.adminManager,
			);
			this.dashboardServer.start();
		}

		// Start Gateway Server
		const gatewaySettings = this.settings.gateway;
		if (gatewaySettings?.port) {
			this.gatewayServer = new GatewayServer(
				gatewaySettings.port,
				gatewaySettings.token || "meta-bun-gateway-token",
				this.pluginManager,
			);
			this.gatewayServer.start();
		}
	}

	/**
	 * Starts the bridge and initializes the plugin manager loader.
	 */
	public async Start(): Promise<void> {
		try {
			// Start RCON Server
			const rconPort =
				Number(Bun.env["RCON_PORT"]) ||
				this.settings.rcon?.port ||
				this.port + 10;
			this.rconServer = Bun.listen<unknown>({
				hostname: "127.0.0.1",
				port: rconPort,
				reusePort: true,
				socket: {
					data: (socket: any, data: any) => {
						const str = data.toString("utf-8").trim();
						const parts = str.split(" ");
						const rconPass =
							Bun.env["RCON_PASSWORD"] ||
							this.settings.rcon?.password ||
							"meta-bun-rcon";
						if (parts[0] === rconPass) {
							const cmd = parts.slice(1).join(" ");
							this.pluginManager.ServerCommand(cmd);
							socket.write(`[RCON] Command sent to server: ${cmd}\n`);
						} else {
							socket.write("Invalid RCON password\n");
							socket.close();
						}
					},
				},
			} as any);
			this.pluginManager.LogMessage(
				`RCON Sunucusu aktif: port ${rconPort}`,
				"success",
			);

			await this.pluginManager.LoadAllPlugins();

			// Start 128 tickrate loop
			this.isTickLoopRunning = true;
			this.nextTickTime = performance.now();
			this.TickLoop();

			// Start Auto-Updater Service
			if (this.updaterService) {
				this.updaterService.start();
			}

			// Connect to Metamod C++ Bridge
			this.ConnectToBridge();
		} catch (err) {
			if (this.pluginManager) {
				this.pluginManager.LogMessage(
					`Uygulama baslatma hatasi: ${err}`,
					"error",
				);
			} else {
				console.error(`[MetaBun] Fatal startup error: ${err}`);
			}
			throw err;
		}
	}

	/**
	 * Parses and dispatches events to the active player stats and plugin manager.
	 *
	 * @param payload Received GameEvent.
	 */
	private HandlePayload(payload: GameEvent): void {
		if (this.debug) {
			console.log(`[Bridge Debug] Recv: ${JSON.stringify(payload)}`);
		}

		const anyPayload = payload as any;
		if (anyPayload.action === "console_cmd") {
			const player = this.playerManager.GetByUserId(anyPayload.userid);
			const args = anyPayload.args || [];
			this.pluginManager.emit("ConsoleCommand", {
				event: "ConsoleCommand",
				command: args[0] || "",
				args: args.slice(1),
				client: player ? player.index : 0,
			});
			return;
		}
		if (anyPayload.action === "chat_cmd") {
			// In CS2, chat comes as PlayerChat event. We simulate it here.
			const player = this.playerManager.GetByUserId(anyPayload.userid);
			this.pluginManager.emit("PlayerChat", {
				event: "PlayerChat",
				client: player ? player.index : 0,
				text: anyPayload.text,
				team_only: anyPayload.teamOnly || false,
				teamOnly: anyPayload.teamOnly,
				silent: anyPayload.silent || false,
			});
			return;
		}

		if (anyPayload.action === "cvar_value") {
			const cvar = this.pluginManager.FindConVar(anyPayload.name);
			if (cvar) {
				cvar.UpdateValueFromBridge(anyPayload.value);
			}
			this.pluginManager.emit("cvar_value", {
				name: anyPayload.name,
				value: anyPayload.value,
			});
			return;
		}

		if (anyPayload.action === "game_event") {
			this.pluginManager.HandleGameEvent(anyPayload.name, anyPayload.data);
			return;
		}

		if (anyPayload.action === "navmesh_dump" || payload.event === "navmesh_dump") {
			const dump = payload as any; // Cast to any because it might be action or event
			this.navMesh.ParseNavMesh(dump.data);
			return;
		}

		// Handle player management events
		if (payload.event === "PlayerConnect") {
			const conn = payload as PlayerConnectEvent;
			const player = new Player(
				this.bridge,
				this.adminManager,
				this.banManager,
				conn.client,
				conn.name,
				conn.steamid,
				conn.userid,
				conn.isBot ?? false,
			);
			// Set preferred language if provided by the bridge
			if (conn.language) {
				player.SetLanguage(conn.language);
			}
			this.playerManager.AddPlayer(player);
			this.pluginManager.LogMessage(
				`Oyuncu bağlandı: ${conn.name} (ID: ${conn.client})`,
				"info",
			);

			// Fetch steam profile data if not a bot
			if (!player.isBot) {
				discordService
					.SendConnectLog(player)
					.catch((err) =>
						console.error("[Discord Logger] Connect log failed:", err),
					);
			}

			// Emit OnClientPostAdminCheck after data is loaded and admin flags checked
			this.pluginManager.emit("OnClientPostAdminCheck", {
				event: "OnClientPostAdminCheck",
				client: conn.client,
			});
		} else if (payload.event === "PlayerDisconnect") {
			const disc = payload as PlayerDisconnectEvent;
			const player = this.playerManager.Get(disc.client);
			if (player) {
				this.playerManager.RemovePlayer(disc.client);
				this.pluginManager.LogMessage(
					`Oyuncu ayrıldı: ${player.name} (ID: ${disc.client})`,
					"info",
				);
			}
		} else if (payload.event === "PlayerStatsUpdate") {
			const stats = payload as PlayerStatsUpdateEvent;
			const player = this.playerManager.Get(stats.client);
			if (player) {
				player.UpdateStats(stats);
			}
		}

		// Update Tick count if engine tells us
		if ((payload as any).tick !== undefined) {
			this.currentTick = (payload as any).tick;
			this.engineTime = (payload as any).time ?? this.currentTick / 128;
		}

		// General Event dispatch to plugins
		this.pluginManager.emit(payload.event, payload);
	}

	/**
	 * Stops the server and halts the game tickrate loop.
	 */
	public async Stop(): Promise<void> {
		this.isTickLoopRunning = false;
		if (this.tickTimeout) {
			clearTimeout(this.tickTimeout);
			this.tickTimeout = null;
		}
		if (this.clientSocket) {
			this.clientSocket.close();
			this.clientSocket = null;
		}
		if (this.dashboardServer) {
			this.dashboardServer.stop();
			this.dashboardServer = null;
		}
		if (this.gatewayServer) {
			this.gatewayServer.stop();
			this.gatewayServer = null;
		}
		if (this.rconServer) {
			this.rconServer.stop();
			this.rconServer = null;
		}
		if (this.updaterService) {
			this.updaterService.stop();
			this.updaterService = null;
		}
		this.navMesh.Destroy();
		await this.pluginManager.Stop();
	}

	public GetPluginManager(): PluginManager {
		return this.pluginManager;
	}

	public GetPlayerManager(): PlayerManager {
		return this.playerManager;
	}

	public GetNavMesh(): NavMesh {
		return this.navMesh;
	}

	/**
	 * Gets the simulated engine uptime in seconds.
	 */
	public GetEngineTime(): number {
		return this.engineTime;
	}

	/**
	 * Gets the current tick count.
	 */
	public GetCurrentTick(): number {
		return this.currentTick;
	}

	/**
	 * Runs the recursive high-precision game tickrate loop.
	 */
	private TickLoop(): void {
		if (!this.isTickLoopRunning) return;

		this.currentTick++;
		this.engineTime = this.currentTick / 128;

		// Emit GameFrame event
		this.pluginManager.emit("GameFrame", {
			event: "GameFrame",
			tick: this.currentTick,
			time: this.engineTime,
		});

		// Calculate next tick with drift correction
		const now = performance.now();
		this.nextTickTime += this.tickIntervalMs;
		const delay = Math.max(0, this.nextTickTime - now);
		this.tickTimeout = setTimeout(() => this.TickLoop(), delay);
	}
}

process.on("unhandledRejection", (reason, promise) => {
	console.error(
		"[MetaBun App] Unhandled Rejection at:",
		promise,
		"reason:",
		reason,
	);
});

process.on("uncaughtException", (error) => {
	console.error("[MetaBun App] Uncaught Exception:", error);
});

// Start the app if this is the module
if (import.meta.main) {
	const app = new MetaBunApp(Number(Bun.env["BRIDGE_PORT"]) || 27013);
	app.Start();
}
