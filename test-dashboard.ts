import { DashboardServer } from "./src/ts/addons/dashboard/server";

const server = new DashboardServer(3001, "test-pass");
server.start();

console.log("Testing /api/status...");
const response = await fetch("http://localhost:3001/api/status");
const data = await response.json();
console.log("Response:", data);

if (data.status === "online" && typeof data.uptime === "number") {
    console.log("Test passed!");
    server.stop();
    process.exit(0);
} else {
    console.log("Test failed!");
    server.stop();
    process.exit(1);
}
