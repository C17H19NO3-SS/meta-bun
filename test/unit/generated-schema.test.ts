import { describe, expect, it } from "bun:test";
import { CCSPlayerController } from "../../src/ts/generated/index";

// Mock globalThis.Bridge directly in the test to intercept Send calls
let lastSentAction: any = null;
(globalThis as any).Bridge = {
    Send: (action: any) => {
        lastSentAction = action;
    },
    SendAsync: async (action: any) => {
        lastSentAction = action;
        return 100;
    }
};

describe("Generated Schema Classes", () => {
    it("should set entityId via constructor", () => {
        const player = new CCSPlayerController(1);
        expect(player.entityId).toBe(1);
    });

    it("should route async getters to the bridge", async () => {
        const player = new CCSPlayerController(1);
        const health = await player.get_m_iHealth();
        expect(lastSentAction).toEqual({ action: "GetEntityProp", entityId: 1, propName: "m_iHealth" });
        expect(health).toBe(100);
    });

    it("should route setters to the bridge", () => {
        const player = new CCSPlayerController(1);
        player.set_m_iHealth(50);
        expect(lastSentAction).toEqual({ action: "SetEntityProp", entityId: 1, propName: "m_iHealth", value: 50 });
    });
});
