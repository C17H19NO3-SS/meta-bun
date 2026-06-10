import type { Player } from "../players/player";

/**
 * High-level UI component for displaying HTML content in the center of the player's screen.
 * Translates into the 'send_user_message' bridge action.
 */
export class CenterHtmlMenu {
	/**
	 * Initializes the CenterHtmlMenu with the specified HTML content.
	 *
	 * @param html The HTML string to be displayed.
	 */
	constructor(private html: string) {}

	/**
	 * Displays the HTML content to the specified player.
	 *
	 * @param player The player instance to show the menu to.
	 */
	public Show(player: Player): void {
		player.bridge.Send({
			action: "send_user_message",
			msg_type: "CenterHtml",
			client: player.index.toString(),
			html: this.html,
		});
	}
}
