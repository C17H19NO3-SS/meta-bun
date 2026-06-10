import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { MessagePipeline } from "../../src/ts/plugin-system/pipeline";
import type { MessageContext } from "../../src/ts/shared/types/message";

describe("PluginContext Message Pipeline Refactor", () => {
	let pipeline: MessagePipeline;
	let context: PluginContext;
	let mockBridge: any;
	let mockPlayers: any;
	let mockPluginManager: any;

	beforeEach(() => {
		pipeline = new MessagePipeline();
		mockBridge = {
			Send: mock(() => {}),
		};
		mockPlayers = {
			Get: mock((id: number) => {
				if (id === 1) {
					return {
						index: 1,
						Say: mock(() => {}),
						name: "Player1"
					};
				}
				return null;
			}),
		};
		mockPluginManager = {
			on: () => {},
			removeListener: () => {},
			PrintHintText: mock(() => {}),
		};
		const mockAdminManager = {} as any;
		const mockCommandRegistry = {
			RegConsoleCmd: () => {},
			UnregConsoleCmd: () => {},
		} as any;

		context = new PluginContext(
			"TestPlugin",
			mockPluginManager,
			mockBridge,
			mockPlayers,
			mockAdminManager,
			mockCommandRegistry,
			pipeline,
		);
	});

	it("PrintToChat should execute pipeline and send message", async () => {
		const executeSpy = spyOn(pipeline, "execute");
		const message = "Hello Chat";
		
		await context.PrintToChat(1, message);

		expect(executeSpy).toHaveBeenCalled();
		const ctx = executeSpy.mock.calls[0][0] as MessageContext;
		expect(ctx.type).toBe("chat");
		expect(ctx.text).toBe(message);
		expect(ctx.target).toBe(1);
		expect(ctx.sourcePlugin).toBe("TestPlugin");

		const player = mockPlayers.Get(1);
		expect(player.Say).toHaveBeenCalledWith(message);
	});

	it("PrintToChat should be blocked if middleware sets blocked to true", async () => {
		pipeline.register(async (ctx) => {
			ctx.blocked = true;
		}, 1, "blocker");

		const message = "Blocked message";
		await context.PrintToChat(1, message);

		const player = mockPlayers.Get(1);
		expect(player.Say).not.toHaveBeenCalled();
	});

	it("PrintToChat should allow modifying message in pipeline", async () => {
		pipeline.register(async (ctx) => {
			ctx.text = "Modified: " + ctx.text;
			ctx.prefix = "[PRE] ";
		}, 1, "modifier");

		await context.PrintToChat(1, "Hello");

		const player = mockPlayers.Get(1);
		expect(player.Say).toHaveBeenCalledWith("[PRE] Modified: Hello");
	});

	it("PrintToConsole should execute pipeline", async () => {
		const executeSpy = spyOn(pipeline, "execute");
		const message = "Hello Console";

		await context.PrintToConsole(1, message);

		expect(executeSpy).toHaveBeenCalled();
		const ctx = executeSpy.mock.calls[0][0] as MessageContext;
		expect(ctx.type).toBe("console");
		expect(ctx.text).toBe(message);
		expect(ctx.target).toBe(1);

		expect(mockBridge.Send).toHaveBeenCalledWith(expect.objectContaining({
			action: "client_command",
			cmd: expect.stringContaining("echo \"Hello Console\""),
		}));
	});

	it("PrintHintText should execute pipeline", async () => {
		const executeSpy = spyOn(pipeline, "execute");
		const message = "Hello Hint";

		await context.PrintHintText(1, message);

		expect(executeSpy).toHaveBeenCalled();
		const ctx = executeSpy.mock.calls[0][0] as MessageContext;
		expect(ctx.type).toBe("hint");
		expect(ctx.text).toBe(message);

		expect(mockPluginManager.PrintHintText).toHaveBeenCalledWith(1, message);
	});

	it("LogMessage should execute pipeline with prefix", async () => {
		const executeSpy = spyOn(pipeline, "execute");
		const message = "Hello Log";

		await context.LogMessage(message, "error");

		expect(executeSpy).toHaveBeenCalled();
		const ctx = executeSpy.mock.calls[0][0] as MessageContext;
		expect(ctx.type).toBe("log");
		expect(ctx.text).toBe(message);
		expect(ctx.prefix).toContain("[TestPlugin]");
		expect(ctx.prefix).toContain("{Red}"); // error color
	});
});
