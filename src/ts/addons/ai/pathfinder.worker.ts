declare var self: Worker;

import type { Vector } from "./navmesh";

/**
 * Pathfinder worker handles A* pathfinding.
 */

let navMeshData: Uint8Array | null = null;

self.onmessage = (event: MessageEvent) => {
	const { type, id, start, end, data } = event.data;

	if (type === "update") {
		navMeshData = data;
		// In a real implementation, we would parse the binary navmesh here.
		console.log("[Pathfinder Worker] NavMesh data received and updated.");
		return;
	}

	if (type === "request") {
		if (!navMeshData) {
			self.postMessage({ id, error: "NavMesh not loaded" });
			return;
		}

		// Dummy A* implementation: returns a straight path from start to end
		// In the future, this will implement the actual A* algorithm on the navigation graph.
		const dummyPath: Vector[] = [start, end];
		
		// Simulate some processing time
		setTimeout(() => {
			self.postMessage({ id, path: dummyPath });
		}, 10);
	}
};
