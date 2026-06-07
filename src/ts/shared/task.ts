/**
 * Static utility for asynchronous task execution with centralized error handling.
 */
export class TaskRunner {
	/**
	 * Run an async task and handle rejection globally.
	 */
	public static Run(action: () => Promise<void> | Promise<unknown>): void {
		action().catch((error) => {
			console.error("[TaskRunner] Task failed with error:", error);
		});
	}
}
