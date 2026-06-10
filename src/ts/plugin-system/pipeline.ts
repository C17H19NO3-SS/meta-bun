import type {
	MessageContext,
	MessageMiddlewareHandler,
	RegisteredMiddleware,
} from "../shared/types/message";

/**
 * Manages the message processing pipeline.
 * Allows plugins to register middlewares to intercept and modify messages.
 */
export class MessagePipeline {
	private middlewares: RegisteredMiddleware[] = [];

	/**
	 * Registers a new middleware in the pipeline.
	 *
	 * @param handler - The middleware handler function.
	 * @param priority - The priority of the middleware (lowest first).
	 * @param pluginName - The name of the plugin registering the middleware.
	 */
	public register(
		handler: MessageMiddlewareHandler,
		priority: number,
		pluginName: string,
	): void {
		this.middlewares.push({ handler, priority, pluginName });

		// Sort middlewares by priority (lowest first)
		this.middlewares.sort((a, b) => a.priority - b.priority);
	}

	/**
	 * Executes the pipeline with the given context.
	 * Middlewares are executed in order of priority.
	 * If a middleware sets context.blocked to true, the execution stops.
	 *
	 * @param context - The message context to process.
	 * @returns A promise that resolves when the pipeline has finished processing.
	 */
	public async execute(context: MessageContext): Promise<void> {
		for (const middleware of this.middlewares) {
			if (context.blocked) {
				break;
			}

			await middleware.handler(context);
		}
	}

	/**
	 * Gets all registered middlewares. (Mainly for testing)
	 * @internal
	 */
	public getMiddlewares(): RegisteredMiddleware[] {
		return [...this.middlewares];
	}

	/**
	 * Clears all registered middlewares. (Mainly for testing)
	 * @internal
	 */
	public clear(): void {
		this.middlewares = [];
	}
}
