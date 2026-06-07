import { GetContext } from "../shared/context-store";
import type { EventMap } from "../shared/types/events";

/**
 * Hooks a game event from the engine bridge.
 *
 * @param event The engine event name (e.g. "PlayerDeath").
 * @param callback Function called when the event occurs.
 */
export function HookEvent<K extends keyof EventMap>(
	event: K,
	callback: (data: EventMap[K]) => void,
): void;
export function HookEvent(event: string, callback: (data: any) => void): void {
	GetContext().HookEvent(event, callback);
}

/**
 * Hooks a game event before it is processed (can block the event).
 *
 * @param event The engine event name (e.g. "PlayerDeath").
 * @param callback Function called before the event occurs. Return HANDLED to block.
 */
export function HookEventPre<K extends keyof EventMap>(
	event: K,
	callback: (data: EventMap[K]) => number,
): void;
export function HookEventPre(
	event: string,
	callback: (data: any) => number,
): void {
	GetContext().HookEventPre(event, callback);
}
