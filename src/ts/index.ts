import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decode } from "@msgpack/msgpack";
import { BanManager } from "./admins/bans";
import { AdminManager } from "./admins/manager";
import { Bridge } from "./network/bridge";
import { PlayerManager } from "./players/manager";
import { Player } from "./players/player";
import { PluginManager } from "./plugin-system/manager";
import { DatabaseManager } from "./shared/database";
import { discordService } from "./shared/discord";
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

function SteamIdTo64(steamId: string): string | null {
	if (!steamId || steamId === "STEAM_ID_LAN" || steamId === "BOT") return null;
	const parts = steamId.match(/^STEAM_(\d+):(\d+):(\d+)$/);
	if (!parts) {
		if (steamId.length === 17 && steamId.startsWith("7656")) return steamId;
		return null;
	}
	const y = BigInt(parts[2]!);
	const z = BigInt(parts[3]!);
	const communityId = z * BigInt(2) + y + BigInt(76561197960265728);
	return communityId.toString();
}

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
	private socketBuffers: Map<BunSocket, Buffer> = new Map();
	private authenticatedSockets: Set<BunSocket> = new Set();
	private protocol: BridgeProtocol = "ndjson";
	private server: any = null;
	private rconServer: any = null;

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
		this.LoadSettings();
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

		this.protocol =
			Bun.env["BRIDGE_PROTOCOL"] || this.settings.bridge?.protocol || "ndjson";
		this.bridge.SetProtocol(this.protocol as BridgeProtocol);
	}

	private LoadSettings(): void {
		const configPath = join(process.cwd(), "configs", "core", "settings.json");
		if (existsSync(configPath)) {
			try {
				this.settings = JSON.parse(readFileSync(configPath, "utf-8"));
				this.pluginManager.LogMessage(
					"Merkezi ayarlar yuklendi: {Green}configs/core/settings.json{Default}",
				);
			} catch (err) {
				this.pluginManager.LogMessage(
					`{Red}Hata: settings.json yuklenemedi: ${err}`,
				);
			}
		}
	}

	/**
	 * Starts the bridge TCP server and initializes the plugin manager loader.
	 */
	public async Start(): Promise<void> {
		this.server = Bun.listen<unknown>({
			hostname: "0.0.0.0",
			port: this.port,
			reusePort: true,
			socket: {
				open: (socket: any) => {
					const bunSocket = socket as BunSocket;
					this.socketBuffers.set(bunSocket, Buffer.alloc(0));
					const bridgeToken =
						Bun.env["BRIDGE_TOKEN"] || this.settings.bridge?.token;
					if (!bridgeToken) {
						this.pluginManager.LogMessage(
							"Metamod C++ bridge {Green}baglandi{Default} (Yetki gerekmiyor).",
						);
						this.authenticatedSockets.add(bunSocket);
						this.bridge.SetSocket(bunSocket);
						this.pluginManager.emit("BridgeConnected");
					} else {
						this.pluginManager.LogMessage(
							"Metamod C++ bridge {Green}baglandi{Default}. {Yellow}Yetki bekleniyor...{Default}",
						);
					}
				},
				data: (socket: any, data: any) => {
					const bunSocket = socket as BunSocket;
					let buffer = this.socketBuffers.get(bunSocket) || Buffer.alloc(0);
					buffer = Buffer.concat([buffer, data]);
					const bridgeToken =
						Bun.env["BRIDGE_TOKEN"] || this.settings.bridge?.token;

					if (this.protocol === "ndjson") {
						let newlineIndex;
						while ((newlineIndex = buffer.indexOf(10)) !== -1) {
							const lineBuffer = buffer.subarray(0, newlineIndex);
							buffer = buffer.subarray(newlineIndex + 1);
							const line = lineBuffer.toString("utf-8").trim();
							if (line) {
								try {
									const payload = JSON.parse(line) as GameEvent;
									if (
										bridgeToken &&
										!this.authenticatedSockets.has(bunSocket)
									) {
										const authPayload = payload as unknown as AuthEvent;
										if (
											payload.event === "auth" ||
											authPayload.action === "auth"
										) {
											if (authPayload.token === bridgeToken) {
												this.pluginManager.LogMessage(
													"Metamod C++ bridge {Green}yetkilendirildi{Default}.",
												);
												this.authenticatedSockets.add(bunSocket);
												this.bridge.SetSocket(bunSocket);
												this.pluginManager.emit("BridgeConnected");
												this.bridge.Send({ action: "auth_success" });
											} else {
												this.pluginManager.LogMessage(
													"{Red}Hata: Bridge yetkilendirme basarisiz. Yanlis token.{Default}",
												);
												this.bridge.SetSocket(bunSocket);
												this.bridge.Send({ action: "auth_failed" });
												bunSocket.close();
											}
										} else {
											this.pluginManager.LogMessage(
												"{Red}Hata: Yetkisiz paket alindi. Baglanti kesiliyor...{Default}",
											);
											bunSocket.close();
										}
										continue;
									}
									this.HandlePayload(payload);
								} catch (err) {
									this.pluginManager.LogMessage(
										`{Red}Hata: JSON parse hatasi: ${err}`,
									);
								}
							}
						}
						this.socketBuffers.set(bunSocket, buffer);
					} else {
						// Length prefixed framing
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
										const authPayload = payload as unknown as AuthEvent;
										if (
											payload.event === "auth" ||
											authPayload.action === "auth"
										) {
											if (authPayload.token === bridgeToken) {
												this.pluginManager.LogMessage(
													"Metamod C++ bridge {Green}yetkilendirildi{Default}.",
												);
												this.authenticatedSockets.add(bunSocket);
												this.bridge.SetSocket(bunSocket);
												this.pluginManager.emit("BridgeConnected");
											} else {
												this.pluginManager.LogMessage(
													"{Red}Hata: Bridge yetkilendirme basarisiz. Yanlis token.{Default}",
												);
												bunSocket.close();
											}
										} else {
											this.pluginManager.LogMessage(
												"{Red}Hata: Yetkisiz paket alindi. Baglanti kesiliyor...{Default}",
											);
											bunSocket.close();
										}
										continue;
									}

									this.HandlePayload(payload);
								} catch (err) {
									this.pluginManager.LogMessage(
										`{Red}Hata: Ikili paket cozme hatasi: ${err}`,
									);
								}
							} else {
								break;
							}
						}
						this.socketBuffers.set(bunSocket, buffer);
					}
				},
				close: (socket: any) => {
					this.pluginManager.LogMessage(
						"Metamod C++ bridge {Red}ayrildi{Default}.",
					);
					const bunSocket = socket as BunSocket;
					this.bridge.SetSocket(null);
					this.socketBuffers.delete(bunSocket);
					this.authenticatedSockets.delete(bunSocket);
				},
				error: (_socket: any, error: any) => {
					this.pluginManager.LogMessage(`{Red}Bridge soket hatasi: ${error}`);
				},
			},
		} as any);

		this.pluginManager.LogMessage(
			`Soket dinleniyor: {Green}port ${this.port}{Default} (Protokol: {Yellow}${this.protocol}{Default})`,
		);

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
			`RCON Sunucusu aktif: {Green}port ${rconPort}{Default}`,
		);

		await this.pluginManager.LoadAllPlugins();

		// Start 128 tickrate loop
		this.isTickLoopRunning = true;
		this.nextTickTime = performance.now();
		this.TickLoop();
	}

	/**
	 * Parses and dispatches events to the active player stats and plugin manager.
	 *
	 * @param payload Received GameEvent.
	 */
	private HandlePayload(payload: GameEvent): void {
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
				`Oyuncu bağlandı: {Green}${conn.name}{Default} (ID: ${conn.client}${conn.isBot ? ", BOT" : ""})`,
			);

			// Steam Web API lookup
			const steam64 = SteamIdTo64(conn.steamid);
			const steamApiKey =
				Bun.env["STEAM_API_KEY"] || this.settings.steam_api_key;
			if (steam64 && steamApiKey) {
				fetch(
					`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steam64}`,
				)
					.then((res) => res.json() as Promise<any>)
					.then((data) => {
						const playersList = data.response?.players;
						if (playersList && playersList.length > 0) {
							const profile = playersList[0]! as SteamProfile;
							console.log(
								`[Steam Web API] Profile found for ${conn.name}: avatar = ${profile.avatar}, realname = ${profile.realname || "N/A"}`,
							);
							player.steamProfile = profile;
						}
					})
					.catch((err) => {
						console.error(
							`[Steam Web API] Error fetching summary for ${conn.steamid}:`,
							err,
						);
					});
			}

			// Discord Webhook logging
			const logChannelId =
				Bun.env["DISCORD_LOG_CHANNEL_ID"] ||
				this.settings.discord?.log_channel_id;
			if (logChannelId) {
				const discordPayload = {
					title: "📥 Oyuncu Bağlandı",
					color: 65280, // Green
					fields: [
						{ name: "Oyuncu İsmi", value: conn.name, inline: true },
						{ name: "SteamID", value: conn.steamid, inline: true },
						{ name: "Client ID", value: String(conn.client), inline: true },
					],
					timestamp: new Date().toISOString(),
				};
				discordService
					.SendMessage("core", logChannelId, discordPayload)
					.catch((err) =>
						console.error("[Discord Logger] Connect log failed:", err),
					);
			}

			// Emit OnClientPostAdminCheck after data is loaded and admin flags checked
			this.pluginManager.emit("OnClientPostAdminCheck", {
				client: conn.client,
				player,
			});
		} else if (payload.event === "PlayerDisconnect") {
			const disc = payload as PlayerDisconnectEvent;
			const player = this.playerManager.Get(disc.client);
			if (player) {
				this.pluginManager.LogMessage(
					`Oyuncu ayrıldı: {Red}${player.name}{Default} (ID: ${disc.client})`,
				);
				const logChannelId =
					Bun.env["DISCORD_LOG_CHANNEL_ID"] ||
					this.settings.discord?.log_channel_id;
				if (logChannelId) {
					const discordPayload = {
						title: "📤 Oyuncu Ayrıldı",
						color: 16711680, // Red
						fields: [
							{ name: "Oyuncu İsmi", value: player.name, inline: true },
							{ name: "SteamID", value: player.steamId, inline: true },
						],
						timestamp: new Date().toISOString(),
					};
					discordService
						.SendMessage("core", logChannelId, discordPayload)
						.catch((err) =>
							console.error("[Discord Logger] Disconnect log failed:", err),
						);
				}
			} else {
				console.log(`[Bun Core] Player disconnected: index ${disc.client}`);
			}
			this.playerManager.RemovePlayer(disc.client);
		} else if (payload.event === "PlayerStatsUpdate") {
			const stats = payload as PlayerStatsUpdateEvent;
			const player = this.playerManager.Get(stats.client) as Player | undefined;
			if (player) {
				player.UpdateHealth(stats.health);
				player.UpdateArmor(stats.armor);
				player.UpdateMoney(stats.money);
				player.UpdateTeam(stats.team);
				player.UpdateIsAlive(stats.isAlive);
				player.UpdateLocation(stats.x, stats.y, stats.z);
				player.UpdateAngles(stats.ax, stats.ay, stats.az);

				// Update new advanced features
				player.UpdateObserverState(
					stats.isObserver ?? false,
					stats.observerTarget ?? 0,
				);
				player.UpdateEntityFlags(stats.entityFlags ?? 0);
				player.UpdateButtons(stats.buttons ?? 0);
				player.UpdateAmmo(stats.clip1 ?? -1, stats.reserve1 ?? -1);
				player.UpdateVelocity(stats.vx ?? 0, stats.vy ?? 0, stats.vz ?? 0);
				if (stats.clanTag !== undefined) player.SetClanTag(stats.clanTag);
				if (stats.ping !== undefined) player.SetPing(stats.ping);

				if (stats.engineTime !== undefined) {
					this.engineTime = stats.engineTime;
				}
			}
		} else if (payload.event === "ping") {
			const pingPayload = payload as PingEvent;
			this.bridge.Send({
				action: "pong",
				timestamp_ms: pingPayload.timestamp_ms,
			});
		} else if (payload.event === "BridgeLatencyUpdate") {
			const latencyPayload = payload as BridgeLatencyUpdateEvent;
			this.pluginManager.SetBridgeLatency(latencyPayload.latency);
		}

		this.pluginManager.emit(payload.event, payload);
	}

	/**
	 * Helper for tests to access the PluginManager instance.
	 */
	public GetPluginManager(): PluginManager {
		return this.pluginManager;
	}

	/**
	 * Helper for tests to access the Bridge instance.
	 */
	public GetBridge(): Bridge {
		return this.bridge;
	}

	/**
	 * Helper for tests to access the AdminManager instance.
	 */
	public GetAdminManager(): AdminManager {
		return this.adminManager;
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
		if (this.server) {
			this.server.stop();
			this.server = null;
		}
		if (this.rconServer) {
			this.rconServer.stop();
			this.rconServer = null;
		}
		this.pluginManager.Stop();
	}

	/**
	 * Gets the simulated engine uptime in seconds.
	 */
	public GetEngineTime(): number {
		return this.engineTime;
	}

	/**
	 * Gets the total tick count elapsed since start.
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

// Start the app if this is the main module
if (import.meta.main) {
	const app = new MetaBunApp(Number(Bun.env["BRIDGE_PORT"]) || 27013);
	app.Start();
}
