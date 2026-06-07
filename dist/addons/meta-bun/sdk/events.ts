import { GetContext } from "../shared/context-store";
import type { GameEvent } from "../shared/types/events";

/**
 * Hooks a game event from the engine bridge.
 * 
 * @param event The engine event name (e.g. "player_death").
 * @param callback Function called when the event occurs.
 */
export function HookEvent(event: string, callback: (data: GameEvent) => void): void {
  GetContext().HookEvent(event, callback);
}
