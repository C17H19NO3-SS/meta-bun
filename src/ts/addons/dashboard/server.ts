import { join } from "node:path";
import { existsSync } from "node:fs";

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
	 * Creates a new DashboardServer instance.
	 *
	 * @param port The port to listen on.
	 * @param password Optional password for authentication (future use).
	 */
	constructor(
		private port: number,
		private password?: string,
	) {}

	/**
	 * Starts the dashboard server and begins listening for requests.
	 */
	public start(): void {
		this.server = Bun.serve({
			port: this.port,
			fetch: async (req) => {
				const url = new URL(req.url);

				// API Endpoints
				if (url.pathname === "/api/status") {
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
