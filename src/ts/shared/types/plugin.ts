import type { EventEmitter } from "node:events";
import type { IGameBridge } from "./bridge";

/**
 * Interface for the plugin manager, extending the bridge and event emitter.
 */
export interface IPluginManager extends IGameBridge, EventEmitter {
	GetPluginState<T>(pluginName: string, key: string, initialValue: T): T;
	SetPluginState<T>(pluginName: string, key: string, value: T): void;
	RegisterAPI(
		name: string,
		api: Record<string, unknown>,
		pluginName?: string,
	): void;
	UnregisterAPI(name: string): void;
	HasAPI(name: string): boolean;
	GetAPI(name: string): Record<string, unknown>;
	GetAPIAsync(name: string): Promise<Record<string, unknown>>;
	UnhookEventPre(event: string, callback: (data: any) => number): void;
}

/**
 * Interface for a plugin definition.
 */
export interface IPlugin {
	name: string | null;
	version: string | null;
	author?: string | null;

	/**
	 * Triggered when the plugin is loaded by the server.
	 * Perform initial setup, register event hooks, and console commands here.
	 *
	 * @param game The game bridge API giving access to server functions.
	 */
	OnLoad?(game: IGameBridge): void | Promise<void>;

	/**
	 * Triggered when the plugin is unloaded or hot-reloaded.
	 * Clean up resources, timers, and listeners here.
	 */
	OnUnload?(): void | Promise<void>;

	[key: string]: unknown;
}

/**
 * Constructor type for class-based plugins.
 */
export type IPluginConstructor = new () => IPlugin;
