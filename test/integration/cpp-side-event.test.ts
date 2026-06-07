import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { spawn } from "node:child_process";
import { MetaBunApp } from "../../src/ts/index";

describe("C++ Process Event to Bun Command Interceptor End-to-End Test", () => {
	const TEST_PORT = 12399;
	let app: MetaBunApp;

	beforeAll(async () => {
		// Start the real MetaBunApp on a custom test port
		app = new MetaBunApp(TEST_PORT);
		await app.Start();
	});

	afterAll(async () => {
		await app.Stop();
	});

	it("should receive event from C++ process via TCP and execute the registered command on Bun side", async () => {
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

		// 2. Spawn the compiled C++ binary as a separate process
		const cppProcess = spawn("./test_cpp_client", [], {
			cwd: "test/integration",
		});

		let cppStdout = "";
		let cppStderr = "";

		cppProcess.stdout.on("data", (data) => {
			cppStdout += data.toString();
		});

		cppProcess.stderr.on("data", (data) => {
			cppStderr += data.toString();
		});

		const exitCodePromise = new Promise<number | null>((resolve) => {
			cppProcess.on("exit", (code) => {
				resolve(code);
			});
		});

		// 3. Wait for the C++ process to finish (with a timeout of 10s)
		const timeoutPromise = new Promise<null>((_, reject) => {
			setTimeout(() => reject(new Error("C++ Process timed out")), 10000);
		});

		let exitCode;
		try {
			exitCode = await Promise.race([exitCodePromise, timeoutPromise]);
		} catch (err) {
			console.log("--- C++ client stdout (on error) ---");
			console.log(cppStdout);
			console.log("--- C++ client stderr (on error) ---");
			console.log(cppStderr);
			throw err;
		}

		console.log("--- C++ client stdout ---");
		console.log(cppStdout);
		console.log("--- C++ client stderr ---");
		console.log(cppStderr);

		// 4. Verify C++ process executed successfully (exit code 0)
		expect(exitCode).toBe(0);

		// 5. Verify the Bun player was created and command was executed on Bun side with correct args
		const player = playerManager.Get(1);
		expect(player).toBeDefined();
		expect(player.name).toBe("CppProcessTester");

		expect(commandExecuted).toBe(true);
		expect(executedClient).toBe(1);
		expect(executedArgs).toEqual(["cppVal1", "cppVal2"]);
	});
});
