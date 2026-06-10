import { beforeEach, describe, expect, it } from "bun:test";
import { MessagePipeline } from "../../src/ts/plugin-system/pipeline";
import type { MessageContext } from "../../src/ts/shared/types/message";

describe("MessagePipeline", () => {
	let pipeline: MessagePipeline;

	beforeEach(() => {
		pipeline = new MessagePipeline();
	});

	it("should register middlewares and sort them by priority", () => {
		pipeline.register(async () => {}, 10, "plugin1");
		pipeline.register(async () => {}, 5, "plugin2");
		pipeline.register(async () => {}, 20, "plugin3");

		const middlewares = pipeline.getMiddlewares();
		expect(middlewares).toHaveLength(3);
		expect(middlewares[0].priority).toBe(5);
		expect(middlewares[0].pluginName).toBe("plugin2");
		expect(middlewares[1].priority).toBe(10);
		expect(middlewares[1].pluginName).toBe("plugin1");
		expect(middlewares[2].priority).toBe(20);
		expect(middlewares[2].pluginName).toBe("plugin3");
	});

	it("should execute middlewares in the correct order", async () => {
		const order: number[] = [];
		pipeline.register(
			async () => {
				order.push(1);
			},
			10,
			"p1",
		);
		pipeline.register(
			async () => {
				order.push(2);
			},
			5,
			"p2",
		);
		pipeline.register(
			async () => {
				order.push(3);
			},
			20,
			"p3",
		);

		const context: MessageContext = {
			type: "chat",
			message: "hello",
			blocked: false,
		};

		await pipeline.execute(context);
		expect(order).toEqual([2, 1, 3]);
	});

	it("should stop execution if context.blocked is set to true", async () => {
		const order: number[] = [];
		pipeline.register(
			async () => {
				order.push(1);
			},
			5,
			"p1",
		);
		pipeline.register(
			async (ctx) => {
				order.push(2);
				ctx.blocked = true;
			},
			10,
			"p2",
		);
		pipeline.register(
			async () => {
				order.push(3);
			},
			15,
			"p3",
		);

		const context: MessageContext = {
			type: "chat",
			message: "hello",
			blocked: false,
		};

		await pipeline.execute(context);
		expect(order).toEqual([1, 2]);
		expect(context.blocked).toBe(true);
	});

	it("should support both sync and async middlewares", async () => {
		const order: string[] = [];
		pipeline.register(
			() => {
				order.push("sync");
			},
			5,
			"p1",
		);
		pipeline.register(
			async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				order.push("async");
			},
			10,
			"p2",
		);

		const context: MessageContext = {
			type: "chat",
			message: "hello",
			blocked: false,
		};

		await pipeline.execute(context);
		expect(order).toEqual(["sync", "async"]);
	});

	it("should allow modifying the message content", async () => {
		pipeline.register(
			(ctx) => {
				ctx.message = `[Prefix] ${ctx.message}`;
			},
			5,
			"p1",
		);

		const context: MessageContext = {
			type: "chat",
			message: "hello",
			blocked: false,
		};

		await pipeline.execute(context);
		expect(context.message).toBe("[Prefix] hello");
	});
});
