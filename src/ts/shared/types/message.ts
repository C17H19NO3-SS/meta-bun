/**
 * Supported message types in the pipeline.
 */
export type MessageType = "chat" | "console" | "hint" | "log";

/**
 * Context for a message being processed through the pipeline.
 */
export interface MessageContext {
	/**
	 * The type of message.
	 */
	type: MessageType;

	/**
	 * The actual message content.
	 */
	text: string;

	/**
	 * Prefix to be added to the message.
	 */
	prefix: string;

	/**
	 * The target of the message (client index, 0 for all).
	 */
	target: number;

	/**
	 * The name of the plugin that originated the message.
	 */
	sourcePlugin: string;

	/**
	 * Whether the message processing should be blocked.
	 * If set to true, the pipeline stops and the message is not sent.
	 */
	blocked: boolean;

	/**
	 * Additional context data.
	 */
	[key: string]: any;
}

/**
 * A handler function that can modify the message context.
 */
export type MessageMiddlewareHandler = (
	context: MessageContext,
) => Promise<void> | void;

/**
 * A registered middleware in the pipeline.
 */
export interface RegisteredMiddleware {
	handler: MessageMiddlewareHandler;
	priority: number;
	pluginName: string;
}
