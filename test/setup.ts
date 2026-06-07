import { afterAll, beforeAll } from "bun:test";
import fs from "node:fs";
import {
	startIntegrationServer,
	stopIntegrationServer,
} from "./helpers/integration-setup";

const dbPath = "./test_meta_bun.db";

beforeAll(async () => {
	if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
	await startIntegrationServer();
});

afterAll(async () => {
	stopIntegrationServer();
	if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});
