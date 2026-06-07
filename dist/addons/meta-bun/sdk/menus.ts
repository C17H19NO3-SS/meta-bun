import { GetContext } from "../shared/context-store";
import type { IMenu } from "../shared/types/bridge";

/**
 * Creates an interactive multi-option menu displayed to players.
 * 
 * @param title The title/header text of the menu.
 * @param callback Callback triggered when a player selects an item from the menu.
 * @returns The newly created IMenu interface.
 */
export function CreateMenu(title: string, callback: (client: number, info: string) => void): IMenu {
  return GetContext().CreateMenu(title, callback);
}

/**
 * Starts a global server-wide vote.
 * 
 * @param question The question string.
 * @param options List of choices.
 * @param callback Callback triggered when vote ends.
 * @param durationMs Duration of vote.
 */
export function CreateVote(
  question: string,
  options: string[],
  callback: (results: Record<string, number>) => void,
  durationMs?: number
): void {
  GetContext().CreateVote(question, options, callback, durationMs);
}

/**
 * Cancels the active vote in progress.
 * 
 * @returns True if a vote was cancelled, false otherwise.
 */
export function CancelVote(): boolean {
  return GetContext().CancelVote();
}



