import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface DiscordPermissions {
	can_send_messages?: boolean;
	can_manage_channels?: boolean;
	allowed_channels?: string[];
}

/**
 * Service for interacting with Discord Bot API with plugin-based permissions.
 */
export class DiscordService {
	private token: string = "";
	private permissions: Record<string, DiscordPermissions> = {};

	constructor() {
		this.LoadConfig();
	}

	private LoadConfig(): void {
		try {
			// Load Bot Token
			const settingsPath = join(
				process.cwd(),
				"configs",
				"core",
				"settings.json",
			);
			if (existsSync(settingsPath)) {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				this.token = settings.discord?.token || "";
			}

			// Load Permissions
			const permPath = join(
				process.cwd(),
				"configs",
				"core",
				"discord_permissions.json",
			);
			if (existsSync(permPath)) {
				const permData = JSON.parse(readFileSync(permPath, "utf-8"));
				this.permissions = permData.plugins || {};
			}
		} catch (err) {
			console.error("[DiscordService] Error loading configuration:", err);
		}
	}

	/**
	 * Reloads configuration from disk.
	 */
	public Reload(): void {
		this.LoadConfig();
	}

	/**
	 * Checks if a plugin has permission for a specific action.
	 */
	private HasPermission(
		pluginName: string,
		action: keyof DiscordPermissions,
		channelId?: string,
	): boolean {
		const perms = this.permissions[pluginName];
		if (!perms) return false;

		if (action === "can_send_messages") {
			if (!perms.can_send_messages) return false;
			if (
				channelId &&
				perms.allowed_channels &&
				perms.allowed_channels.length > 0
			) {
				return perms.allowed_channels.includes(channelId);
			}
			return true;
		}

		return !!perms[action];
	}

	/**
	 * Sends a message to a Discord channel via the bot.
	 *
	 * @param pluginName The name of the plugin requesting the action.
	 * @param channelId Discord channel ID.
	 * @param content Message content or embed object.
	 */
	public async SendMessage(
		pluginName: string,
		channelId: string,
		content: string | object,
	): Promise<boolean> {
		if (!this.token) {
			console.error(
				`[DiscordService] Cannot send message: No bot token configured.`,
			);
			return false;
		}

		if (!this.HasPermission(pluginName, "can_send_messages", channelId)) {
			console.warn(
				`[DiscordService] Permission denied for plugin '${pluginName}' to send message to channel ${channelId}.`,
			);
			return false;
		}

		try {
			const body =
				typeof content === "string" ? { content } : { embeds: [content] };
			const response = await fetch(
				`https://discord.com/api/v10/channels/${channelId}/messages`,
				{
					method: "POST",
					headers: {
						Authorization: `Bot ${this.token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify(body),
				},
			);

			if (!response.ok) {
				const errData = await response.json();
				console.error(`[DiscordService] Discord API Error:`, errData);
				return false;
			}

			return true;
		} catch (err) {
			console.error(`[DiscordService] Request failed:`, err);
			return false;
		}
	}
}

export const discordService = new DiscordService();
