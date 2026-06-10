import { describe, expect, it, mock } from "bun:test";
import { CenterHtmlMenu } from "../../../src/ts/ui/CenterHtmlMenu";
import { Player } from "../../../src/ts/players/player";
import { Bridge } from "../../../src/ts/network/bridge";
import { AdminManager } from "../../../src/ts/admins/manager";
import { BanManager } from "../../../src/ts/admins/bans";
import { DatabaseManager } from "../../../src/ts/shared/database";

describe("CenterHtmlMenu Unit Tests", () => {
	it("should send the correct bridge payload when Show() is called", () => {
		// Mock Bridge
		const bridge = new Bridge();
		const sendSpy = mock((_payload) => {});
		bridge.Send = sendSpy;

		// Mock Dependencies
		const db = new DatabaseManager(":memory:");
		const adminManager = new AdminManager(db);
		const banManager = new BanManager(db);
		
		const player = new Player(
			bridge,
			adminManager,
			banManager,
			1,
			"TestPlayer",
			"STEAM_0:0:1",
			100
		);

		const html = "<h1>Test HTML</h1><p>Content</p>";
		const menu = new CenterHtmlMenu(html);
		
		menu.Show(player);

		expect(sendSpy).toHaveBeenCalledTimes(1);
		expect(sendSpy.mock.calls[0][0]).toEqual({
			action: "send_user_message",
			msg_type: "CenterHtml",
			client: "1",
			html: html,
		});
	});
});
