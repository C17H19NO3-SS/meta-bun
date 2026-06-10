/**
 * Static utility for asynchronous task execution with centralized error handling.
 */
export class TaskRunner {
	/**
	 * Run an async task and handle rejection globally.
	 */
	public static Run(action: () => Promise<void> | Promise<unknown>): void {
		const result = action();
		if (!result || typeof result.then !== "function") {
			console.error("[Task.Run] Action must be an asynchronous function (Promise)");
			return;
		}
		result.catch((error) => {
			console.error("[Task.Run] Task failed with error:", error);
		});
	}
}
