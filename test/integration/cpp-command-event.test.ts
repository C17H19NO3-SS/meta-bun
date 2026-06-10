import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { encode, decode } from "@msgpack/msgpack";
import { MetaBunApp } from "../../src/ts/index";

describe("C++ Event to Bun Command Interceptor End-to-End Test", () => {
	const TEST_PORT = 12389;
	let app: MetaBunApp;
	let mockCppServer: any;
	let clientSocketForMock: any = null;

	beforeAll(async () => {
		process.env.BRIDGE_PROTOCOL = "length_prefixed_msgpack";
		
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

	it("should process registered console commands on Bun side when chat_cmd event is received from mock C++ bridge", async () => {
		if (!clientSocketForMock) throw new Error("Mock server never got a connection from Bun app");

		const pluginManager = app.GetPluginManager();
		const playerManager = app.GetPlayerManager();

		// 1. Register a test command on Bun side
		let commandExecuted = false;
		let executedClient = -1;
		let executedArgs: string[] = [];

		pluginManager.RegConsoleCmd("sm_test_cpp_command", (client, args) => {
			commandExecuted = true;
			executedClient = client;
			executedArgs = args;
		});

		// 2. Send PlayerConnect event
		const connectPayload = {
			event: "PlayerConnect",
			client: 1,
			name: "CppTester",
			steamid: "STEAM_0:0:12345",
			userid: 99,
			isBot: false,
			language: "tr",
		};
		const encodedConn = encode(connectPayload);
		const headerConn = Buffer.alloc(4);
		headerConn.writeUInt32BE(encodedConn.length, 0);
		clientSocketForMock.write(Buffer.concat([headerConn, encodedConn]));

		// Wait a brief moment for Bun to process PlayerConnect
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify player is successfully tracked
		const player = playerManager.Get(1);
		expect(player).toBeDefined();
		expect(player?.name).toBe("CppTester");

		// 3. Send chat_cmd action representing the chat command input "!test_cpp_command val1 val2"
		const chatPayload = {
			action: "chat_cmd",
			userid: 99,
			text: "!test_cpp_command val1 val2",
			teamOnly: false,
		};
		const encodedChat = encode(chatPayload);
		const headerChat = Buffer.alloc(4);
		headerChat.writeUInt32BE(encodedChat.length, 0);
		clientSocketForMock.write(Buffer.concat([headerChat, encodedChat]));

		// Wait a brief moment for the Bun command interceptor to process it
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify command was successfully executed on Bun side with correct args
		expect(commandExecuted).toBe(true);
		expect(executedClient).toBe(1);
		expect(executedArgs).toEqual(["val1", "val2"]);
	});
});
