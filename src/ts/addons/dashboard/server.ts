import { join } from "node:path";
import { existsSync } from "node:fs";
import type { AdminManager } from "../../admins/manager";

/**
 * DashboardServer provides a web interface and API for MetaBun server management.
 * It uses Bun.serve to provide a high-performance standalone web server.
 */
export class DashboardServer {
	/**
	 * The underlying Bun server instance.
	 */
	private server: any;

	/**
	 * The time when the server was started.
	 */
	private startTime: number = Date.now();

	/**
	 * Map of session tokens to SteamID64s.
	 */
	private sessions: Map<string, string> = new Map();

	/**
	 * Creates a new DashboardServer instance.
	 *
	 * @param port The port to listen on.
	 * @param password Optional password for authentication (future use).
	 * @param adminManager Reference to the AdminManager for permission checks.
	 */
	constructor(
		private port: number,
		private password?: string,
		private adminManager?: AdminManager,
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

		return null;
	}

	/**
	 * Starts the dashboard server and begins listening for requests.
	 */
	public start(): void {
		this.server = Bun.serve({
			port: this.port,
			fetch: async (req, server) => {
				const url = new URL(req.url);

				// WebSocket upgrade
				if (url.pathname === "/ws") {
					if (this.validateAdminSession(req)) {
						if (server.upgrade(req)) {
							return;
						}
					}
					return new Response("Forbidden", { status: 403 });
				}

				// Auth Endpoints
				if (url.pathname === "/auth/login") {
					const params = new URLSearchParams({
						"openid.ns": "http://specs.openid.net/auth/2.0",
						"openid.mode": "checkid_setup",
						"openid.return_to": `${url.protocol}//${url.host}/api/auth/callback`,
						"openid.realm": `${url.protocol}//${url.host}/`,
						"openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
						"openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
					});
					return Response.redirect(
						`https://steamcommunity.com/openid/login?${params.toString()}`,
					);
				}

				if (url.pathname === "/api/auth/callback") {
					const params = new URLSearchParams(url.search);
					params.set("openid.mode", "check_authentication");

					const response = await fetch("https://steamcommunity.com/openid/login", {
						method: "POST",
						body: params,
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
					});

					const text = await response.text();
					if (text.includes("is_valid:true")) {
						const claimedId = params.get("openid.claimed_id");
						const steamId64 = claimedId?.split("/").pop();
						if (steamId64) {
							const sessionToken = crypto.randomUUID();
							this.sessions.set(sessionToken, steamId64);
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

				// API Endpoints
				if (url.pathname === "/api/status") {
					if (!this.validateAdminSession(req)) {
						return new Response("Forbidden", { status: 403 });
					}
					return Response.json({
						uptime: (Date.now() - this.startTime) / 1000,
						tickrate: 128, // Basic server info
						status: "online",
					});
				}

				// Serve static files
				if (url.pathname === "/" || url.pathname === "/index.html") {
					const filePath = join(import.meta.dir, "public", "index.html");
					if (existsSync(filePath)) {
						return new Response(Bun.file(filePath));
					}
				}

				return new Response("Not Found", { status: 404 });
			},
			websocket: {
				message(ws, message) {
					console.log(`[Dashboard] WS message: ${message}`);
				},
				open(ws) {
					console.log("[Dashboard] WS connection opened");
				},
				close(ws) {
					console.log("[Dashboard] WS connection closed");
				},
			},
		});

		console.log(`[Dashboard] Server running at http://localhost:${this.port}`);
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
