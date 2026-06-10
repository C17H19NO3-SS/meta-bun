/**
 * Base class for all MetaBun specific errors.
 */
export class MetaBunError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Errors related to the bridge connection, protocol, or socket operations.
 */
export class BridgeError extends MetaBunError {
	constructor(
		message: string,
		public readonly context?: any,
	) {
		super(message);
	}
}

/**
 * Errors related to plugin loading, execution, or management.
 */
export class PluginError extends MetaBunError {
	constructor(
		message: string,
		public readonly pluginName?: string,
		public readonly context?: any,
	) {
		super(pluginName ? `[${pluginName}] ${message}` : message);
	}
}

/**
 * Errors related to invalid native calls or game-specific operation failures.
 */
export class NativeError extends MetaBunError {
	constructor(
		message: string,
		public readonly nativeName: string,
		public readonly clientIndex?: number,
	) {
		super(
			clientIndex !== undefined
				? `Native '${nativeName}' failed for client ${clientIndex}: ${message}`
				: `Native '${nativeName}' failed: ${message}`,
		);
	}
}
