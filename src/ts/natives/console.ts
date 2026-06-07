import { GetContext } from "../shared/context-store";
import type { CommandCallback } from "../shared/types/bridge";
import type { ReplySource } from "../shared/types/enums";

export {
	ReplySource,
	ReplySource_Chat,
	ReplySource_Console,
} from "../shared/types/enums";

/**
 * Registers a console command in the game engine.
 * When the command is invoked by a client or server console, the callback triggers.
 *
 * @param command Name of the command (e.g., "sm_slap").
 * @param callback Callback function executed when the command is run.
 * @param description Optional description text showing in the console.
 */
export function RegConsoleCmd(
	command: string,
	callback: CommandCallback,
	flags?: string | null,
	description?: string | null,
): void {
	GetContext().RegConsoleCmd(command, callback, flags, description);
}

/**
 * Executes a console command on the server engine.
 *
 * @param cmd The command line string to run (e.g., "mp_restartgame 1").
 */
export function ServerCommand(cmd: string): void {
	GetContext().ServerCommand(cmd);
}

/**
 * Checks if a player has permission to run a specific command.
 *
 * @param client The client index.
 * @param command The console command being checked.
 * @param flags The required permission flags (e.g., "z").
 * @returns True if the client has permission, false otherwise.
 */
export function CheckCommandAccess(
	client: number,
	command: string,
	flags: string,
): boolean {
	return GetContext().CheckCommandAccess(client, command, flags);
}

/**
 * Gets the permission flags assigned to a client.
 *
 * @param client The client index.
 * @returns A string representing the client flags (e.g., "abcdef").
 */
export function GetUserFlagBits(client: number): string {
	return GetContext().GetUserFlagBits(client);
}

/**
 * Prints a message directly to a client's console.
 *
 * @param client The client index.
 * @param message The message text.
 */
export function PrintToConsole(client: number, message: string): void {
	GetContext().PrintToConsole(client, message);
}

/**
 * Gets the current command execution source.
 *
 * @returns ReplySource (Console = 0, Chat = 1)
 */
export function GetCmdReplySource(): ReplySource {
	return GetContext().GetCmdReplySource();
}
