import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { encode, decode } from "@msgpack/msgpack";
import { MetaBunApp } from "../../src/ts/index";

describe("Generic Game Event Handling", () => {
	const TEST_PORT = 28000;
	let app: MetaBunApp;
	let mockCppServer: any;
	let clientSocketForMock: any = null;

	beforeAll(async () => {
		process.env.BRIDGE_PROTOCOL = "length_prefixed_msgpack";
		process.env.RCON_PORT = "28010";
		
		// 1. Start a mock C++ server
		mockCppServer = Bun.listen({
			hostname: "127.0.0.1",
			port: TEST_PORT,
			socket: {
				data(socket, data) {
					let buffer = (socket as any).buffer || Buffer.alloc(0);
					buffer = Buffer.concat([buffer, data]);
					
					while (buffer.length >= 4) {
						const len = buffer.readUInt32BE(0);
						if (buffer.length >= 4 + len) {
							const payload = decode(buffer.subarray(4, 4 + len)) as any;
							buffer = buffer.subarray(4 + len);
							
							if (payload.action === "auth") {
								const resp = encode({ action: "auth_success" });
								const head = Buffer.alloc(4);
								head.writeUInt32BE(resp.length, 0);
								socket.write(Buffer.concat([head, resp]));
							}
						} else break;
					}
					(socket as any).buffer = buffer;
				},
				open(socket) {
					clientSocketForMock = socket;
				}
			}
		});

		// 2. Start the real MetaBunApp
		app = new MetaBunApp(TEST_PORT);
		await app.Start();
		
		// Wait for client to connect to our server
		let attempts = 0;
		while (!clientSocketForMock && attempts < 20) {
			await new Promise(r => setTimeout(r, 100));
			attempts++;
		}
	});

	afterAll(async () => {
		await app.Stop();
		mockCppServer.stop();
		delete process.env.BRIDGE_PROTOCOL;
	});

	it("should handle generic game_event and emit via PluginManager", async () => {
		if (!clientSocketForMock) throw new Error("Mock server never got a connection from Bun app");

		const pluginManager = app.GetPluginManager();

		// 1. Register a listener for a non-hardcoded event
		let eventReceived = false;
		let receivedEventName = "";
		let receivedData: any = null;

		pluginManager.on("item_pickup", (data: any) => {
			eventReceived = true;
			receivedEventName = "item_pickup";
			receivedData = data;
		});

		// 2. Send generic game_event payload from mock C++ bridge
		const eventPayload = {
			action: "game_event",
			name: "item_pickup",
			data: {
				item: "ak47",
				userid: 1
			}
		};
		const encoded = encode(eventPayload);
		const header = Buffer.alloc(4);
		header.writeUInt32BE(encoded.length, 0);
		clientSocketForMock.write(Buffer.concat([header, encoded]));

		// Wait a brief moment
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify event was successfully emitted and received
		expect(eventReceived).toBe(true);
		expect(receivedEventName).toBe("item_pickup");
		expect(receivedData).toEqual({ item: "ak47", userid: 1 });
	});
});
