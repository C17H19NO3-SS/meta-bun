import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Bridge } from "../network/bridge";
import { Menu } from "./menu";

describe("Menu Class", () => {
	let bridge: Bridge;
	let menu: Menu;

	beforeEach(() => {
		bridge = new Bridge();
		// Mock bridge.Send to avoid socket errors
		spyOn(bridge, "Send").mockImplementation(() => {});
		menu = new Menu(bridge, "Test Menu");
	});

	test("should initialize with correct title and unique ID", () => {
		expect(menu.GetId()).toBeDefined();
		expect(typeof menu.GetId()).toBe("string");
	});

	test("should add items correctly", () => {
		menu.AddItem("info1", "Item 1");
		menu.AddItem("info2", "Item 2");
		// Items are private, so we test via Display
		menu.Display(1);

		const lastCall = (bridge.Send as any).mock.calls[0][0];
		const items = JSON.parse(lastCall.menu_items_json);
		expect(items).toHaveLength(2);
		expect(items[0].info).toBe("info1");
		expect(items[1].display).toBe("Item 2");
	});

	test("should clear items", () => {
		menu.AddItem("info1", "Item 1");
		menu.ClearItems();
		menu.Display(1);

		const lastCall = (bridge.Send as any).mock.calls[0][0];
		const items = JSON.parse(lastCall.menu_items_json);
		expect(items).toHaveLength(0);
	});

	test("should handle pagination slicing", () => {
		menu.SetPagination(true, 3);
		for (let i = 1; i <= 10; i++) {
			menu.AddItem(`info${i}`, `Item ${i}`);
		}

		// Page 1
		menu.Display(1, 1);
		let lastCall = (bridge.Send as any).mock.calls[0][0];
		let items = JSON.parse(lastCall.menu_items_json);

		// 3 items + 3 spacers (to reach index 5) + Back + Next + Exit = 9 items
		expect(items).toHaveLength(9);
		expect(items[0].info).toBe("info1");
		expect(items[1].info).toBe("info2");
		expect(items[2].info).toBe("info3");
		expect(items[3].info).toBe("__none__"); // Spacer
		expect(items[6].info).toBe("__none__"); // Back (should be none on p1)
		expect(items[7].info).toBe("__next__"); // Next
		expect(items[8].info).toBe("__exit__"); // Exit

		// Page 2
		menu.Display(1, 2);
		lastCall = (bridge.Send as any).mock.calls[1][0];
		items = JSON.parse(lastCall.menu_items_json);
		expect(items[0].info).toBe("info4");
		expect(items[6].info).toBe("__back__");
	});

	test("should cap itemsPerPage at 6", () => {
		menu.SetPagination(true, 10);
		// It should be capped at 6
		menu.AddItem("info1", "Item 1");
		menu.Display(1);

		const lastCall = (bridge.Send as any).mock.calls[0][0];
		const items = JSON.parse(lastCall.menu_items_json);
		// itemsPerPage 6 + 0 spacers + Back + Next + Exit = 9 items
		// Wait, if I only added 1 item, it will have 5 spacers to reach index 5 (Slot 6)
		expect(items).toHaveLength(9);
	});

	test("should handle internal navigation correctly", () => {
		menu.SetPagination(true, 2);
		menu.AddItem("info1", "Item 1");
		menu.AddItem("info2", "Item 2");
		menu.AddItem("info3", "Item 3");

		menu.Display(1, 1);

		// Next
		const nextHandled = menu.HandleInternalNavigation(1, "__next__");
		expect(nextHandled).toBe(true);
		// Should have called Display for page 2
		expect((bridge.Send as any).mock.calls).toHaveLength(2);

		// Back
		const backHandled = menu.HandleInternalNavigation(1, "__back__");
		expect(backHandled).toBe(true);
		// Should have called Display for page 1
		expect((bridge.Send as any).mock.calls).toHaveLength(3);

		// Exit
		const exitHandled = menu.HandleInternalNavigation(1, "__exit__");
		expect(exitHandled).toBe(true);

		// None
		const noneHandled = menu.HandleInternalNavigation(1, "__none__");
		expect(noneHandled).toBe(true);

		// Real item
		const realHandled = menu.HandleInternalNavigation(1, "info1");
		expect(realHandled).toBe(false);
	});
});
