import type { CommandOptions } from "./types/bridge";

/**
 * Decorator to register a class method as a console command.
 */
export function Command(
	name: string,
	options?: CommandOptions | string | null,
	description?: string | null,
) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const constructor = target.constructor as unknown as {
			__commands?: Array<{
				name: string;
				methodName: string;
				options?: CommandOptions | string | null;
				description?: string | null;
			}>;
		};
		if (!constructor.__commands) {
			constructor.__commands = [];
		}
		constructor.__commands.push({
			name,
			methodName: propertyKey,
			options,
			description,
		});
		return descriptor;
	};
}

/**
 * Decorator to register a class method as an administrative console command.
 */
export function AdminCommand(
	name: string,
	options: CommandOptions | string = "b",
	description: string | null = null,
) {
	return Command(name, options, description);
}

/**
 * Decorator to register a class method as a game event hook.
 */
export function Hook(eventName: string) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const constructor = target.constructor as unknown as {
			__eventHooks?: Array<{ eventName: string; methodName: string }>;
		};
		if (!constructor.__eventHooks) {
			constructor.__eventHooks = [];
		}
		constructor.__eventHooks.push({ eventName, methodName: propertyKey });
		return descriptor;
	};
}

/**
 * Alias for Hook.
 */
export const HookEvent = Hook;

/**
 * Decorator to register a class method as a shared API.
 */
export function SharedAPI(apiName: string) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const constructor = target.constructor as unknown as {
			__sharedAPIs?: Array<{ apiName: string; methodName: string }>;
		};
		if (!constructor.__sharedAPIs) {
			constructor.__sharedAPIs = [];
		}
		constructor.__sharedAPIs.push({ apiName, methodName: propertyKey });
		return descriptor;
	};
}
