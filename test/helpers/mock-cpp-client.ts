// test/mock-cpp-client.ts
const _socket = await Bun.connect({
	hostname: "127.0.0.1",
	port: 8080,
	socket: {
		data(_socket, data) {
			console.log("[C++ Mock] Received from Bun:", data.toString());
			// Expecting: {"action":"say","text":"Client ID: 1 - Pong!"}

			// Close after receiving the correct response
			setTimeout(() => process.exit(0), 100);
		},
		open(socket) {
			console.log("[C++ Mock] Connected to Bun Core.");
			// Simulate a chat event from Metamod
			const payload =
				JSON.stringify({ event: "PlayerChat", client: 1, text: "!ping" }) +
				"\n";
			console.log("[C++ Mock] Sending event to Bun:", payload.trim());
			socket.write(payload);
		},
		close(_socket) {
			console.log("[C++ Mock] Connection closed.");
		},
		error(_socket, error) {
			console.error("[C++ Mock] Socket error:", error);
		},
	},
});
