import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { MetaBunApp } from "../../src/ts/index";

describe("C++ Process Event to Bun Command Interceptor End-to-End Test", () => {
	const TEST_PORT = 12399;
	let app: MetaBunApp;
	let mockCppServer: any;
	let clientSocketForMock: any = null;

	beforeAll(async () => {
		// We only use length-prefixed msgpack now for the bridge
		process.env.BRIDGE_PROTOCOL = "length_prefixed_msgpack";

		// 1. Start a mock C++ server
		mockCppServer = Bun.listen({
			hostname: "127.0.0.1",
			port: TEST_PORT,
			socket: {
				data(socket, data) {
					// Dummy handler to allow data receipt
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

	it("should receive event from mock C++ bridge via TCP and execute the registered command on Bun side", async () => {
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

		// 2. Send PlayerConnect event using length-prefixed JSON (as fallback) or MsgPack
		const connectPayload = {
			event: "PlayerConnect",
			client: 1,
			name: "CppProcessTester",
			steamid: "STEAM_0:0:9876",
			userid: 98,
			isBot: false,
			language: "en",
		};
		// Use msgpack as it's the default when not length_prefixed_json
		const { encode } = require("@msgpack/msgpack");
		const encoded = encode(connectPayload);
		const header = Buffer.alloc(4);
		header.writeUInt32BE(encoded.length, 0);
		clientSocketForMock.write(Buffer.concat([header, encoded]));

		// Wait a brief moment for Bun to process PlayerConnect and instantiate the Player
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify player is successfully tracked
		const player = playerManager.Get(1);
		expect(player).toBeDefined();
		expect(player?.name).toBe("CppProcessTester");

		// 3. Send ConsoleCommand event
		const cmdPayload = {
			action: "console_cmd",
			userid: 98,
			args: ["sm_test_cpp_command", "cppVal1", "cppVal2"],
		};
		const encodedCmd = encode(cmdPayload);
		const headerCmd = Buffer.alloc(4);
		headerCmd.writeUInt32BE(encodedCmd.length, 0);
		clientSocketForMock.write(Buffer.concat([headerCmd, encodedCmd]));

		// Wait a brief moment for the Bun command interceptor to process it
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Verify command was successfully executed on Bun side with correct args
		expect(commandExecuted).toBe(true);
		expect(executedClient).toBe(1);
		expect(executedArgs).toEqual(["cppVal1", "cppVal2"]);
	});
});
