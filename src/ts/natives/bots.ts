import { GetContext } from "../shared/context-store";

/**
 * Native functions for managing AI bots on the server.
 */
export const bots = {
	/**
	 * Adds a bot to the server.
	 */
	Add(): void {
		GetContext().BotAdd();
	},

	/**
	 * Kicks all bots from the server.
	 */
	KickAll(): void {
		GetContext().BotKickAll();
	},

	/**
	 * Kicks a specific bot from the server.
	 *
	 * @param client Client index of the bot.
	 */
	Kick(client: number): void {
		GetContext().BotKick(client);
	},

	/**
	 * Sets the server's bot quota.
	 *
	 * @param count The desired number of bots.
	 */
	SetQuota(count: number): void {
		const cvar = GetContext().FindConVar("bot_quota");
		if (cvar) {
			cvar.SetInt(count);
		} else {
			GetContext().ServerCommand(`bot_quota ${count}`);
		}
	},

	/**
	 * Gets the current bot quota.
	 *
	 * @returns The current quota value.
	 */
	GetQuota(): number {
		const cvar = GetContext().FindConVar("bot_quota");
		return cvar ? cvar.GetInt() : 0;
	},

	/**
	 * Sets the bot difficulty level.
	 *
	 * @param level Difficulty level (0-3).
	 */
	SetDifficulty(level: number): void {
		const cvar = GetContext().FindConVar("bot_difficulty");
		if (cvar) {
			cvar.SetInt(level);
		} else {
			GetContext().ServerCommand(`bot_difficulty ${level}`);
		}
	},

	/**
	 * Gets the current bot difficulty level.
	 *
	 * @returns Difficulty level.
	 */
	GetDifficulty(): number {
		const cvar = GetContext().FindConVar("bot_difficulty");
		return cvar ? cvar.GetInt() : 0;
	},
};
