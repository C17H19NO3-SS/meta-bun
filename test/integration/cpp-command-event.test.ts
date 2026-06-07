import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { MetaBunApp } from "../../src/ts/index";

describe("C++ Event to Bun Command Interceptor End-to-End Test", () => {
	const TEST_PORT = 12389;
	let app: MetaBunApp;

	beforeAll(async () => {
		// Start the real MetaBunApp on a custom test port
		app = new MetaBunApp(TEST_PORT);
		await app.Start();
	});

	afterAll(async () => {
		await app.Stop();
	});

	it("should process registered console commands on Bun side when PlayerChat event is received from C++ bridge", async () => {
		const pluginManager = app.GetPluginManager();
		const playerManager = (app as any).playerManager;

		// 1. Register a test command on Bun side
		let commandExecuted = false;
		let executedClient = -1;
		let executedArgs: string[] = [];

		pluginManager.RegConsoleCmd("sm_test_cpp_command", (client, args) => {
			commandExecuted = true;
			executedClient = client;
			executedArgs = args;
		});

		// 2. Connect the mock C++ client via TCP socket to the Bun server
		let _receivedData = "";
		const clientSocket = await Bun.connect({
			hostname: "127.0.0.1",
			port: TEST_PORT,
			socket: {
				data(_socket, data) {
					_receivedData += data.toString("utf-8");
				},
			},
		});

		// 3. Handle token authentication if BRIDGE_TOKEN is configured
		if (process.env.BRIDGE_TOKEN) {
			const authPayload = {
				event: "auth",
				token: process.env.BRIDGE_TOKEN,
			};
			clientSocket.write(`${JSON.stringify(authPayload)}\n`);
			// Wait a moment for auth response
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// 4. Send PlayerConnect event representing the player connecting from C++ side
		const connectPayload = {
			event: "PlayerConnect",
			client: 1,
			name: "CppTester",
			steamid: "STEAM_0:0:12345",
			userid: 99,
			isBot: false,
			language: "tr",
		};
		clientSocket.write(`${JSON.stringify(connectPayload)}\n`);

		// Wait a brief moment for Bun to process PlayerConnect and instantiate the Player
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Verify player is successfully tracked in playerManager
		const player = playerManager.Get(1);
		expect(player).toBeDefined();
		expect(player.name).toBe("CppTester");

		// 5. Send PlayerChat event representing the chat command input "!test_cpp_command val1 val2"
		const chatPayload = {
			event: "PlayerChat",
			client: 1,
			text: "!test_cpp_command val1 val2",
		};
		clientSocket.write(`${JSON.stringify(chatPayload)}\n`);

		// Wait a brief moment for the Bun command interceptor to process it
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Verify command was successfully executed on Bun side with correct args
		expect(commandExecuted).toBe(true);
		expect(executedClient).toBe(1);
		expect(executedArgs).toEqual(["val1", "val2"]);

		clientSocket.end();
	});
});
