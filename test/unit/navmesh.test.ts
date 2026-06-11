import { expect, test, describe, afterAll } from "bun:test";
import { NavMesh } from "../../src/ts/addons/ai/navmesh";

describe("NavMesh Pathfinding", () => {
	const navMesh = new NavMesh();

	afterAll(() => {
		navMesh.Destroy();
	});

	test("GetPath returns a dummy path after NavMesh update", async () => {
		// Mock navmesh data
		const mockData = Buffer.from("dummy navmesh data");
		navMesh.ParseNavMesh(mockData);

		const start = { x: 0, y: 0, z: 0 };
		const end = { x: 100, y: 100, z: 100 };

		const path = await navMesh.GetPath(start, end);

		expect(path).toBeArray();
		expect(path).toHaveLength(2);
		expect(path[0]).toEqual(start);
		expect(path[1]).toEqual(end);
	});

	test("GetPath returns empty array if NavMesh not updated", async () => {
		const navMeshNoData = new NavMesh();
		const start = { x: 0, y: 0, z: 0 };
		const end = { x: 100, y: 100, z: 100 };

		const path = await navMeshNoData.GetPath(start, end);
		expect(path).toEqual([]);
		
		navMeshNoData.Destroy();
	});
});
