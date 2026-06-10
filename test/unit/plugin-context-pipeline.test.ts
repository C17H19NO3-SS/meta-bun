import { describe, expect, it, spyOn } from "bun:test";
import { PluginContext } from "../../src/ts/plugin-system/context";
import { MessagePipeline } from "../../src/ts/plugin-system/pipeline";
import type { MessageContext } from "../../src/ts/shared/types/message";

describe("PluginContext Message Pipeline Integration", () => {
	it("should register message middleware and unregister it on cleanup", () => {
		// Mock dependencies
		const mockPluginManager = {
			on: () => {},
			removeListener: () => {},
		} as any;
		const mockBridge = {} as any;
		const mockPlayers = {} as any;
		const mockAdminManager = {} as any;
		const mockCommandRegistry = {
			RegConsoleCmd: () => {},
			UnregConsoleCmd: () => {},
		} as any;
		
		const pipeline = new MessagePipeline();
		const registerSpy = spyOn(pipeline, "register");
		const unregisterSpy = spyOn(pipeline, "unregisterPluginMiddlewares");

		const pluginName = "TestPipelinePlugin";
		const context = new PluginContext(
			pluginName,
			mockPluginManager,
			mockBridge,
			mockPlayers,
			mockAdminManager,
			mockCommandRegistry,
			pipeline,
		);

		const handler = async (ctx: MessageContext) => {
			ctx.text = "modified";
		};
		const priority = 50;

		// 1. Test RegisterMessageMiddleware
		context.RegisterMessageMiddleware(handler, priority);

		expect(registerSpy).toHaveBeenCalledWith(handler, priority, pluginName);
		expect(pipeline.getMiddlewares()).toHaveLength(1);
		expect(pipeline.getMiddlewares()[0].pluginName).toBe(pluginName);

		// 2. Test Cleanup unregisters middlewares
		context.Cleanup();

		expect(unregisterSpy).toHaveBeenCalledWith(pluginName);
		expect(pipeline.getMiddlewares()).toHaveLength(0);
	});

	it("should use default priority if not specified", () => {
		const mockPluginManager = {
			on: () => {},
			removeListener: () => {},
		} as any;
		const mockBridge = {} as any;
		const mockPlayers = {} as any;
		const mockAdminManager = {} as any;
		const mockCommandRegistry = {
			RegConsoleCmd: () => {},
			UnregConsoleCmd: () => {},
		} as any;
		
		const pipeline = new MessagePipeline();
		const registerSpy = spyOn(pipeline, "register");

		const pluginName = "DefaultPriorityPlugin";
		const context = new PluginContext(
			pluginName,
			mockPluginManager,
			mockBridge,
			mockPlayers,
			mockAdminManager,
			mockCommandRegistry,
			pipeline,
		);

		const handler = async (_ctx: MessageContext) => {};
		context.RegisterMessageMiddleware(handler);

		expect(registerSpy).toHaveBeenCalledWith(handler, 100, pluginName);
	});
});
