import { join } from "node:path";

/**
 * Represents a 3D vector.
 */
export interface Vector {
	x: number;
	y: number;
	z: number;
}

/**
 * NavMesh class manages the navigation graph and pathfinding via a worker.
 */
export class NavMesh {
	private worker: Worker | null = null;
	private pendingPaths: Map<string, (path: Vector[]) => void> = new Map();
	private requestId = 0;

	constructor() {
		this.InitializeWorker();
	}

	/**
	 * Initializes the pathfinder worker.
	 */
	private InitializeWorker() {
		const workerPath = join(import.meta.dir, "pathfinder.worker.ts");
		this.worker = new Worker(workerPath);

		this.worker.onmessage = (event) => {
			const { id, path, error } = event.data;
			const resolve = this.pendingPaths.get(id);
			if (resolve) {
				if (error) {
					console.error(`[NavMesh] Pathfinding error for request ${id}: ${error}`);
					resolve([]);
				} else {
					resolve(path);
				}
				this.pendingPaths.delete(id);
			}
		};

		this.worker.onerror = (err) => {
			console.error("[NavMesh] Worker error:", err);
		};
	}

	/**
	 * Parses and updates the NavMesh data.
	 * 
	 * @param data The binary dump from C++ bridge.
	 */
	public ParseNavMesh(data: Buffer) {
		if (this.worker) {
			this.worker.postMessage({ type: "update", data }, [data.buffer as ArrayBuffer]);
		}
	}

	/**
	 * Finds a path between two points.
	 * 
	 * @param start Start position.
	 * @param end End position.
	 * @returns A promise that resolves to an array of vectors representing the path.
	 */
	public GetPath(start: Vector, end: Vector): Promise<Vector[]> {
		return new Promise((resolve) => {
			if (!this.worker) {
				console.error("[NavMesh] Worker not initialized");
				return resolve([]);
			}

			const id = (this.requestId++).toString();
			this.pendingPaths.set(id, resolve);

			this.worker.postMessage({
				type: "request",
				id,
				start,
				end,
			});
		});
	}

	/**
	 * Terminates the worker.
	 */
	public Destroy() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}
}
