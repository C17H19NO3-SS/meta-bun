import { GetContext } from "../shared/context-store";
import type { Timer } from "../shared/types/bridge";

/**
 * Creates a scheduled timer that executes a callback after a specific duration.
 * 
 * @param ms Delay in milliseconds.
 * @param callback The function to execute.
 * @param repeat If true, the timer repeats periodically.
 * @returns A Timer handle that can be used with KillTimer.
 */
export function CreateTimer(ms: number, callback: () => void, repeat?: boolean): Timer {
  return GetContext().CreateTimer(ms, callback, repeat);
}

/**
 * Kills/cancels an active timer, stopping any future executions.
 * 
 * @param timer The Timer handle returned from CreateTimer.
 */
export function KillTimer(timer: Timer): void {
  GetContext().KillTimer(timer);
}
