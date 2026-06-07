import { AsyncLocalStorage } from "node:async_hooks";

/**
 * SDK context-store shim used inside the deployed dist/.
 *
 * The MetaBun runtime (index.js) stores its AsyncLocalStorage instance on
 * globalThis.__metaBunContextStore so that sdk/ copies of the natives — which
 * Bun loads as separate module instances — still share the exact same context
 * as the bundled runtime.
 */
export function GetContext(): any {
  const store: AsyncLocalStorage<any> | undefined =
    (globalThis as any).__metaBunContextStore;
  if (!store) {
    throw new Error(
      "[MetaBun] Context store not found. Make sure the MetaBun runtime is loaded."
    );
  }
  const context = store.getStore();
  if (!context) {
    throw new Error("[MetaBun] Native function called outside of an active plugin context!");
  }
  return context;
}

/** Compatibility alias so import-only consumers do not break. */
export const pluginContextStore = {
  getStore: (): any => (globalThis as any).__metaBunContextStore?.getStore(),
} as any;
