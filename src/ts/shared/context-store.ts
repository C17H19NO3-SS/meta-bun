import { AsyncLocalStorage } from "node:async_hooks";
import type { PluginContext } from "../plugin-system/context";

declare global {
	// eslint-disable-next-line no-var
	var __metaBunContextStore: AsyncLocalStorage<PluginContext> | undefined;
	// eslint-disable-next-line no-var
	var __metaBunCommandSourceStore:
		| AsyncLocalStorage<"chat" | "console">
		| undefined;
}

/**
 * Global store tracking the execution context of active plugins.
 * Stored on globalThis so that SDK modules loaded as separate Bun module
 * instances (e.g. the copied sdk/ files in dist/) can share the same
 * AsyncLocalStorage as the bundled runtime.
 */
if (!globalThis.__metaBunContextStore) {
	globalThis.__metaBunContextStore = new AsyncLocalStorage<PluginContext>();
}

export const pluginContextStore = globalThis.__metaBunContextStore!;

if (!globalThis.__metaBunCommandSourceStore) {
	globalThis.__metaBunCommandSourceStore = new AsyncLocalStorage<
		"chat" | "console"
	>();
}

export const commandSourceStore = globalThis.__metaBunCommandSourceStore!;

/**
 * Gets the current active plugin context.
 * Throws an error if called from outside a plugin context lifecycle.
 *
 * @returns The active PluginContext.
 */
export function GetContext(): PluginContext {
	const context = pluginContextStore.getStore();
	if (!context) {
		throw new Error(
			"[MetaBun] Native function called outside of active plugin context!",
		);
	}
	return context;
}
