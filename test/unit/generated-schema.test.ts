import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { CCSPlayerController } from "../../src/ts/generated/index";

describe("Generated Schema Classes", () => {
	let originalBridge: any;
	const mockSend = mock();

	beforeEach(() => {
		originalBridge = (globalThis as any).Bridge;
		(globalThis as any).Bridge = { Send: mockSend };
		mockSend.mockClear();
	});

	afterEach(() => {
		(globalThis as any).Bridge = originalBridge;
	});

	it("should set entityId via constructor", () => {
		const controller = new CCSPlayerController(123);
		expect(controller.entityId).toBe(123);
	});

	it("should route getters to the bridge", () => {
		const controller = new CCSPlayerController(456);
		mockSend.mockReturnValueOnce(100);

		const health = controller.m_iHealth;

		expect(health).toBe(100);
		expect(mockSend).toHaveBeenCalledWith({
			action: "GetEntityProp",
			entityId: 456,
			propName: "m_iHealth",
		});
	});

	it("should route setters to the bridge", () => {
		const controller = new CCSPlayerController(789);

		controller.m_iHealth = 50;

		expect(mockSend).toHaveBeenCalledWith({
			action: "SetEntityProp",
			entityId: 789,
			propName: "m_iHealth",
			value: 50,
		});
	});
});
