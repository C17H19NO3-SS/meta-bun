import type { PluginManager } from "../../plugin-system/manager";

/**
 * GatewayServer provides a WebSocket interface for external integrations.
 * It broadcasts live game events and allows authenticated clients to execute commands.
 */
export class GatewayServer {
	/**
	 * The underlying Bun server instance.
	 */
	private server: any;

	/**
	 * Set of connected and authenticated WebSocket clients.
	 */
	private clients: Set<any> = new Set();

	/**
	 * Creates a new GatewayServer instance.
	 *
	 * @param port The port to listen on.
	 * @param token The Bearer token required for authentication.
	 * @param pluginManager The PluginManager instance to subscribe to events.
	 */
	constructor(
		private port: number,
		private token: string,
		private pluginManager: PluginManager,
	) {}

	/**
	 * Starts the gateway server and begins listening for connections.
	 */
	public start(): void {
		this.server = Bun.serve({
			port: this.port,
			fetch: (req, server) => {
				const url = new URL(req.url);

				// Upgrade the request to a WebSocket connection
				if (url.pathname === "/gateway") {
					const authHeader = req.headers.get("Authorization");
					const authToken = authHeader?.startsWith("Bearer ")
						? authHeader.substring(7)
						: null;

					const success = server.upgrade(req, {
						data: {
							authToken: authToken,
						},
					});

					return success
						? undefined
						: new Response("Upgrade failed", { status: 400 });
				}

				return new Response("MetaBun WebSocket Gateway", { status: 200 });
			},
			websocket: {
				open: (ws) => {
					// Check authentication
					if (ws.data.authToken !== this.token) {
						ws.send(JSON.stringify({ event: "error", message: "Unauthorized" }));
						ws.close(1008, "Unauthorized");
						return;
					}

					this.clients.add(ws);
					ws.send(JSON.stringify({ event: "connected", message: "Authenticated" }));
				},
				message: (ws, message) => {
					try {
						const data = JSON.parse(message.toString());
						if (data.action === "execute_command" && data.command) {
							this.pluginManager.ServerCommand(data.command);
							ws.send(
								JSON.stringify({
									event: "command_executed",
									command: data.command,
								}),
							);
						}
					} catch (err) {
						ws.send(
							JSON.stringify({
								event: "error",
								message: "Invalid message format",
							}),
						);
					}
				},
				close: (ws) => {
					this.clients.delete(ws);
				},
			},
		});

		// Subscribe to PluginManager events and broadcast them
		// We intercept the emit method to catch all events
		const originalEmit = this.pluginManager.emit.bind(this.pluginManager);
		this.pluginManager.emit = (event: string | symbol, ...args: any[]) => {
			// Skip high-frequency events to save bandwidth
			if (event !== "GameFrame") {
				this.broadcast(event.toString(), args[0]);
			}
			return originalEmit(event, ...args);
		};

		console.log(`[Gateway] WebSocket server running at ws://localhost:${this.port}/gateway`);
	}

	/**
	 * Broadcasts a game event to all authenticated clients.
	 *
	 * @param event The name of the event.
	 * @param data The event data.
	 */
	private broadcast(event: string, data: any): void {
		const payload = JSON.stringify({ event, data });
		for (const client of this.clients) {
			client.send(payload);
		}
	}

	/**
	 * Stops the gateway server gracefully.
	 */
	public stop(): void {
		if (this.server) {
			this.server.stop();
			console.log("[Gateway] Server stopped");
		}
	}
}
