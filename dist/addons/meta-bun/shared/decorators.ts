import { pluginContextStore } from "./context-store";

/**
 * Decorator to register a class method as a console command.
 */
export function Command(name: string, flags: string | null = null, description: string | null = null) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const constructor = target.constructor as unknown as { __commands?: Array<{ name: string; methodName: string; flags: string | null; description: string | null }> };
    if (!constructor.__commands) {
      constructor.__commands = [];
    }
    constructor.__commands.push({ name, methodName: propertyKey, flags, description });
    return descriptor;
  };
}

/**
 * Decorator to register a class method as a game event hook.
 */
export function Hook(eventName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const constructor = target.constructor as unknown as { __eventHooks?: Array<{ eventName: string; methodName: string }> };
    if (!constructor.__eventHooks) {
      constructor.__eventHooks = [];
    }
    constructor.__eventHooks.push({ eventName, methodName: propertyKey });
    return descriptor;
  };
}

/**
 * Decorator to register a class method as a shared API.
 */
export function SharedAPI(apiName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const constructor = target.constructor as unknown as { __sharedAPIs?: Array<{ apiName: string; methodName: string }> };
    if (!constructor.__sharedAPIs) {
      constructor.__sharedAPIs = [];
    }
    constructor.__sharedAPIs.push({ apiName, methodName: propertyKey });
    return descriptor;
  };
}
