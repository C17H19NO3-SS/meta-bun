import { beforeAll, afterAll } from "bun:test";
import { startIntegrationServer, stopIntegrationServer } from "./helpers/integration-setup";
import fs from "fs";

const dbPath = "./test_meta_bun.db";

beforeAll(async () => {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  await startIntegrationServer();
});

afterAll(async () => {
  stopIntegrationServer();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});
