import type { Server } from "bun";
import { Bridge } from "../../src/ts/network/bridge";

let server: Server;
const PORT = 9000;

export async function startIntegrationServer() {
	server = Bun.listen({
		hostname: "127.0.0.1",
		port: PORT,
		socket: {
			data(socket, _data) {
				// Gerçek entegrasyon testlerinde buraya C++ eklentisi gibi davranan
				// yanıtlar döndüren mantık eklenebilir.
				socket.write('{"status":"ok"}\n');
			},
		},
	});
	console.log(`Integration Bridge Server running on port ${PORT}`);
}

export function stopIntegrationServer() {
	server.stop();
}

export function getIntegrationBridge() {
	// Gerçek soket bağlantısı olan bir Bridge döner
	const bridge = new Bridge();
	// Bridge'in portunu test portuna yönlendir (eğer mümkünse)
	return bridge;
}
