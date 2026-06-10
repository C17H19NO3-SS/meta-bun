import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { BanManager } from "../../src/ts/admins/bans";
import { AdminManager } from "../../src/ts/admins/manager";
import { Bridge } from "../../src/ts/network/bridge";
import { PlayerManager } from "../../src/ts/players/manager";
import { Player } from "../../src/ts/players/player";
import { DatabaseManager } from "../../src/ts/shared/database";
import type { GameAction } from "../../src/ts/shared/types/bridge";
import { PluginManager } from "../../src/ts/plugin-system/manager";
import { Team } from "../../src/ts/shared/types/enums";

describe("Command System Integration Tests", () => {
    const dbPath = "./test_commands.db";
    let db: DatabaseManager;
    let banManager: BanManager;
    let bridge: Bridge;
    let playerManager: PlayerManager;
    let adminManager: AdminManager;
    let pluginManager: PluginManager;

    beforeAll(async () => {
        db = new DatabaseManager(dbPath);
        banManager = new BanManager(db);
        bridge = new Bridge();
        playerManager = new PlayerManager(db, false);
        adminManager = new AdminManager();
        pluginManager = new PluginManager(bridge, playerManager, adminManager, false);
    });

    afterAll(() => {
        db.close();
    });

    it("should send correct register_command payload to bridge", async () => {
        let lastAction: any = null;
        bridge.Send = (action: GameAction) => {
            lastAction = action;
        };

        pluginManager.RegConsoleCmd("sm_test_silent_reg", () => {}, {
            description: "Silent command",
            silent: true,
            flags: 0
        });

        expect(lastAction).toEqual({
            action: "register_command",
            name: "sm_test_silent_reg",
            description: "Silent command",
            flags: 0,
            silent: true
        });
    });

    it("should handle silent chat triggers (/) correctly", async () => {
        let commandsCalled: string[] = [];
        pluginManager.RegConsoleCmd("sm_test_cmd", () => {
            commandsCalled.push("sm_test_cmd");
        });

        const player = new Player(bridge, adminManager, banManager, 1, "Alice", "STEAM_A", 101);
        playerManager.AddPlayer(player);

        const chatEvent = {
            event: "PlayerChat",
            client: 1,
            text: "/test_cmd",
            silent: true
        };

        const listeners = pluginManager.preListeners.get("PlayerChat");
        expect(listeners).toBeDefined();
        
        const result = await listeners![0](chatEvent as any);
        
        expect(commandsCalled).toContain("sm_test_cmd");
        expect(result).toBe(3); // Plugin_Handled
    });

    it("should handle public chat triggers (!) as silent if registered with silent: true", async () => {
        let commandsCalled: string[] = [];
        pluginManager.RegConsoleCmd("sm_test_silent_public", () => {
            commandsCalled.push("sm_test_silent_public");
        }, { silent: true });

        const player = new Player(bridge, adminManager, banManager, 2, "Bob", "STEAM_B", 102);
        playerManager.AddPlayer(player);

        const chatEvent = {
            event: "PlayerChat",
            client: 2,
            text: "!test_silent_public",
            silent: false
        };

        const listeners = pluginManager.preListeners.get("PlayerChat");
        const result = await listeners![0](chatEvent as any);
        
        expect(commandsCalled).toContain("sm_test_silent_public");
        expect(result).toBe(3); // Plugin_Handled
    });

    it("should NOT hide public chat triggers (!) if NOT registered as silent", async () => {
        let commandsCalled: string[] = [];
        pluginManager.RegConsoleCmd("sm_test_normal", () => {
            commandsCalled.push("sm_test_normal");
        }, { silent: false });

        const player = new Player(bridge, adminManager, banManager, 3, "Charlie", "STEAM_C", 103);
        playerManager.AddPlayer(player);

        const chatEvent = {
            event: "PlayerChat",
            client: 3,
            text: "!test_normal",
            silent: false
        };

        const listeners = pluginManager.preListeners.get("PlayerChat");
        const result = await listeners![0](chatEvent as any);
        
        expect(commandsCalled).toContain("sm_test_normal");
        expect(result).toBe(0); // Plugin_Continue
    });

    it("should handle FindTargets correctly with @all", () => {
        const p1 = new Player(bridge, adminManager, banManager, 10, "Target1", "STEAM_10", 110);
        const p2 = new Player(bridge, adminManager, banManager, 11, "Target2", "STEAM_11", 111);
        playerManager.AddPlayer(p1);
        playerManager.AddPlayer(p2);

        const targets = playerManager.FindTargets("@all");
        expect(targets.length >= 2).toBe(true);
        expect(targets.map(p => p.name)).toContain("Target1");
        expect(targets.map(p => p.name)).toContain("Target2");
    });
});
