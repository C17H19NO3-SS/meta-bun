import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AdminManager } from "../../admins/manager";
import type { PlayerManager } from "../../players/manager";
import type { PluginManager } from "../../plugin-system/manager";

/**
 * DashboardServer provides a secure web interface and API for MetaBun server management.
 * It uses Bun.serve to provide a high-performance standalone web server and WebSocket gateway.
 * Authenticated via Steam OAuth.
 */
export class DashboardServer {
	/**
	 * The underlying Bun server instance.
	 */
	private server: any;

	/**
	 * Set of connected WebSocket clients.
	 */
	private wsClients: Set<any> = new Set();

	/**
	 * Buffer of recent logs to persist across reloads.
	 */
	private logBuffer: Array<{
		message: string;
		type: string;
		timestamp: number;
	}> = [];
	private maxLogLines = 2000;

	/**
	 * Map of session tokens to SteamID64s.
	 */
	private sessions: Map<string, string> = new Map();

	/**
	 * The time when the server was started.
	 */
	private startTime: number = Date.now();

	/**
	 * Creates a new DashboardServer instance.
	 *
	 * @param port The port to listen on.
	 * @param pluginManager Reference to the PluginManager for server actions.
	 * @param playerManager Reference to the PlayerManager for client management.
	 * @param adminManager Reference to the AdminManager for permission checks.
	 * @param steamApiKey Optional Steam Web API key for profile data.
	 * @param password Optional password for authentication.
	 */
	constructor(
		private port: number,
		private pluginManager: PluginManager,
		private playerManager: PlayerManager,
		private adminManager: AdminManager,
		private steamApiKey?: string,
		private password?: string,
	) {}

	/**
	 * Validates the admin session from the request cookies.
	 *
	 * @param req The incoming request.
	 * @returns The SteamID64 if valid and has 'z' flag, null otherwise.
	 */
	private validateAdminSession(req: Request): string | null {
		const cookie = req.headers.get("Cookie");
		if (!cookie) return null;

		const sessionToken = cookie
			.split(";")
			.map((c) => c.trim())
			.find((c) => c.startsWith("session="))
			?.split("=")[1];

		if (!sessionToken) return null;

		const steamId = this.sessions.get(sessionToken);
		if (!steamId) return null;

		if (!this.adminManager) return null;

		// Check for root flag 'z'
		const flags = this.adminManager.GetFlags(steamId);
		if (flags.includes("z")) {
			return steamId;
		}

		console.warn(
			`[Dashboard] User ${steamId} logged in but lacks 'z' flag. Flags: ${flags}`,
		);
		return null;
	}

	/**
	 * Starts the dashboard server and begins listening for requests.
	 */
	public start(): void {
		this.server = Bun.serve({
			port: this.port,
			hostname: "127.0.0.1",
			fetch: async (req, server) => {
				const url = new URL(req.url);

				// WebSocket upgrade
				if (url.pathname === "/ws") {
					const success = server.upgrade(req);
					return success
						? undefined
						: new Response("WS Upgrade failed", { status: 400 });
				}

				// Auth Endpoints
				if (url.pathname === "/auth/login") {
					const params = new URLSearchParams({
						"openid.ns": "http://specs.openid.net/auth/2.0",
						"openid.mode": "checkid_setup",
						"openid.return_to": `${url.protocol}//${url.host}/api/auth/callback`,
						"openid.realm": `${url.protocol}//${url.host}/`,
						"openid.identity":
							"http://specs.openid.net/auth/2.0/identifier_select",
						"openid.claimed_id":
							"http://specs.openid.net/auth/2.0/identifier_select",
					});
					return Response.redirect(
						`https://steamcommunity.com/openid/login?${params.toString()}`,
					);
				}

				if (url.pathname === "/api/auth/callback") {
					const params = new URLSearchParams(url.search);
					params.set("openid.mode", "check_authentication");

					const response = await fetch(
						"https://steamcommunity.com/openid/login",
						{
							method: "POST",
							body: params,
							headers: {
								"Content-Type": "application/x-www-form-urlencoded",
							},
						},
					);

					const text = await response.text();
					if (text.includes("is_valid:true")) {
						const claimedId = params.get("openid.claimed_id");
						const steamId64 = claimedId?.split("/").pop();
						if (steamId64) {
							const sessionToken = crypto.randomUUID();
							this.sessions.set(sessionToken, steamId64);

							console.log(
								`[Dashboard] Session created for ${steamId64}: ${sessionToken}`,
							);

							return new Response(null, {
								status: 302,
								headers: {
									Location: "/",
									"Set-Cookie": `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
								},
							});
						}
					}
					return new Response("Authentication failed", { status: 401 });
				}

				// Public API Endpoints
				if (url.pathname === "/api/status") {
					const adminSteamId = this.validateAdminSession(req);
					return Response.json(this.GetServerStatus(adminSteamId !== null));
				}

				// Admin API Endpoints (Protected)
				if (url.pathname.startsWith("/api/admin/")) {
					const adminSteamId = this.validateAdminSession(req);
					if (!adminSteamId) {
						return new Response("Forbidden", { status: 403 });
					}

					if (req.method === "POST") {
						try {
							const body = await req.json();

							if (url.pathname === "/api/admin/kick") {
								this.playerManager?.KickClient(
									body.userId,
									body.reason || "Kicked via Dashboard",
								);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) kicked player ID ${body.userId}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/map") {
								this.pluginManager?.ServerCommand(`map ${body.mapName}`);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) changed map to ${body.mapName}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/plugins/reload") {
								await this.pluginManager?.ReloadPlugin(body.pluginName);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) reloaded plugin ${body.pluginName}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/plugins/unload") {
								await this.pluginManager?.UnloadPlugin(body.pluginName);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) unloaded plugin ${body.pluginName}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/plugins/load") {
								await this.pluginManager?.LoadPlugin(body.pluginName);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) loaded plugin ${body.pluginName}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/rcon") {
								this.pluginManager?.ServerCommand(body.command);
								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) executed RCON: ${body.command}`,
								);
								return Response.json({ success: true });
							}

							if (url.pathname === "/api/admin/mapalias") {
								const aliasesFile = join(
									process.cwd(),
									"configs",
									"core",
									"map_aliases.json",
								);
								let aliases: Record<string, string> = {};
								if (existsSync(aliasesFile)) {
									aliases = JSON.parse(readFileSync(aliasesFile, "utf-8"));
								}
								aliases[body.name.toLowerCase()] = body.workshopId;
								writeFileSync(aliasesFile, JSON.stringify(aliases, null, 2));

								// Force refresh in admin plugin if active
								this.pluginManager?.ServerCommand("sm_rehash");

								this.pluginManager?.LogMessage(
									`Web Admin (${adminSteamId}) added map alias: ${body.name} -> ${body.workshopId}`,
								);
								return Response.json({ success: true });
							}
						} catch (e) {
							return new Response(`Action failed: ${e}`, { status: 500 });
						}
					}

					if (url.pathname === "/api/admin/plugins") {
						const loaded = this.pluginManager
							? this.pluginManager.GetLoadedPlugins()
							: [];
						const available = this.pluginManager
							? this.pluginManager.GetAvailablePlugins()
							: [];
						return Response.json({ loaded, available });
					}

					if (url.pathname === "/api/admin/maps") {
						const maps = this.pluginManager
							? this.pluginManager.GetKnownMaps()
							: [];
						return Response.json({ maps });
					}
				}

				// Serve static files
				if (url.pathname === "/" || url.pathname === "/index.html") {
					const devPath = join(import.meta.dir, "public", "index.html");
					const prodPath = join(process.cwd(), "public", "index.html");
					const filePath = existsSync(devPath) ? devPath : prodPath;

					if (existsSync(filePath)) {
						return new Response(Bun.file(filePath));
					}
				}

				return new Response("Not Found", { status: 404 });
			},
			websocket: {
				open: (ws) => {
					this.wsClients.add(ws);
					// Send initial state (always public view first)
					ws.send(
						JSON.stringify({
							event: "status_update",
							data: this.GetServerStatus(false),
						}),
					);
					// Send log history
					ws.send(
						JSON.stringify({ event: "log_history", data: this.logBuffer }),
					);
				},
				close: (ws) => {
					this.wsClients.delete(ws);
				},
			},
		});

		// Listen for player events to broadcast updates
		this.pluginManager?.on("PlayerConnected", () => this.BroadcastUpdate());
		this.pluginManager?.on("PlayerDisconnected", () => this.BroadcastUpdate());
		this.pluginManager?.on("PlayerSpawned", () => this.BroadcastUpdate());

		// Broadcast server logs to admins
		this.pluginManager?.on("log", (data) => {
			// Save to buffer
			this.logBuffer.push(data);
			if (this.logBuffer.length > this.maxLogLines) {
				this.logBuffer.shift();
			}

			const payload = JSON.stringify({ event: "server_log", data });
			for (const client of this.wsClients) {
				client.send(payload);
			}
		});

		// Heartbeat for uptime and periodic stats
		setInterval(() => this.BroadcastUpdate(), 1000);

		console.log(`[Dashboard] Server running at http://127.0.0.1:${this.port}`);
	}

	/**
	 * Gets the current server status data.
	 */
	private GetServerStatus(isAdmin: boolean) {
		const players =
			this.playerManager?.GetInGameClients().map((p) => ({
				index: p.index,
				name: p.name,
				team: p.GetTeam(),
				health: p.GetHealth(),
				steamId: isAdmin ? p.steamId : undefined,
			})) || [];

		return {
			uptime: (Date.now() - this.startTime) / 1000,
			tickrate: 128,
			status: "online",
			playerCount: players.length,
			maxPlayers: 64,
			players: players,
			isAdmin: isAdmin,
		};
	}

	/**
	 * Broadcasts a status update to all connected WebSocket clients.
	 */
	private BroadcastUpdate(): void {
		// Broadcast public view to everyone
		const payload = JSON.stringify({
			event: "status_update",
			data: this.GetServerStatus(false),
		});
		for (const client of this.wsClients) {
			client.send(payload);
		}
	}

	/**
	 * Stops the dashboard server gracefully.
	 */
	public stop(): void {
		if (this.server) {
			this.server.stop();
			console.log("[Dashboard] Server stopped");
		}
	}
}
