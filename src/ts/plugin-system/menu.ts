import type { Bridge } from "../network/bridge";
import type { IMenu, MenuItem } from "../shared/types/bridge";

/**
 * Implements IMenu to represent dynamic multi-option client menus.
 * Now supports pagination, subtitles, and specialized UI types.
 *
 * Layout:
 * 1-5: Items
 * 7: Back
 * 8: Next
 * 9: Exit
 */
export class Menu implements IMenu {
	private title: string = "";
	private subtitle: string = "";
	private items: MenuItem[] = [];
	private id: string;
	private pagination: boolean = false;
	private itemsPerPage: number = 5;
	private lastPage: number = 1;

	constructor(
		private bridge: Bridge,
		title: string,
	) {
		this.title = title;
		this.id = crypto.randomUUID();
	}

	public GetId(): string {
		return this.id;
	}

	public SetTitle(title: string): void {
		this.title = title;
	}

	public SetSubtitle(subtitle: string): void {
		this.subtitle = subtitle;
	}

	public SetPagination(enabled: boolean, itemsPerPage: number = 5): void {
		this.pagination = enabled;
		this.itemsPerPage = itemsPerPage;
	}

	public AddItem(
		info: string,
		display: string,
		_disabled: boolean = false,
	): void {
		this.items.push({ info, display });
	}

	public Display(client: number, page: number = 1): void {
		this.lastClient = client;
		this.lastPage = page;

		let displayItems: MenuItem[] = [];
		let footer = "";
		let menuType = 0;

		if (this.pagination) {
			menuType = 2; // Paginated
			const totalPages = Math.ceil(this.items.length / this.itemsPerPage);
			if (page < 1) page = 1;
			if (page > totalPages) page = totalPages;

			const start = (page - 1) * this.itemsPerPage;
			const slicedItems = this.items.slice(start, start + this.itemsPerPage);

			// 1-5: Actual items
			displayItems = [...slicedItems];

			// Slot 6: Spacer (Index 5)
			while (displayItems.length < 6) {
				displayItems.push({ display: "---", info: "__none__" });
			}

			// Slot 7: Back (Index 6)
			if (page > 1) {
				displayItems.push({ display: "<- Geri (Back)", info: "__back__" });
			} else {
				displayItems.push({ display: "---", info: "__none__" });
			}

			// Slot 8: Next (Index 7)
			if (page < totalPages) {
				displayItems.push({ display: "İleri (Next) ->", info: "__next__" });
			} else {
				displayItems.push({ display: "---", info: "__none__" });
			}

			// Slot 9: Exit (Index 8)
			displayItems.push({ display: "Çıkış (Exit)", info: "__exit__" });

			footer = `Sayfa ${page} / ${totalPages}`;
		} else {
			displayItems = this.items;
		}

		this.bridge.Send({
			action: "menu",
			client,
			menu_id: this.id,
			menu_title: this.title,
			menu_subtitle: this.subtitle,
			menu_footer: footer,
			menu_type: menuType.toString(),
			menu_items_json: JSON.stringify(displayItems),
		});
	}

	public HandleInternalNavigation(client: number, info: string): boolean {
		if (info === "__next__") {
			this.Display(client, this.lastPage + 1);
			return true;
		}
		if (info === "__back__") {
			this.Display(client, this.lastPage - 1);
			return true;
		}
		if (info === "__exit__") {
			return false;
		}
		return false;
	}
}
