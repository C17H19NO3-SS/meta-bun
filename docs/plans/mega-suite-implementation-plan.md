# MetaBun Mega-Suite Implementation Plan

This plan details the implementation of the MetaBun Mega-Suite modular add-ons.

## Phase 1: Network Services (Dashboard & WebSocket)

### Task 1: Web Dashboard Skeleton
- **Context:** Standalone React/HTML dashboard powered by `Bun.serve()`.
- **Requirements:**
  1. Create `src/ts/addons/dashboard/server.ts`.
  2. Implement a basic `DashboardServer` class using `Bun.serve`.
  3. Serve a static HTML file from `src/ts/addons/dashboard/public/index.html`.
  4. Implement an API endpoint `/api/status` returning basic server info (tickrate, uptime).
  5. Add configuration in `configs/core/settings.json` for dashboard port and password.
- **Review Criteria:** Running the dashboard server allows accessing the status API via browser.

### Task 2: WebSocket Gateway
- **Context:** Secure gateway for external integrations.
- **Requirements:**
  1. Create `src/ts/addons/gateway/websocket.ts`.
  2. Implement `GatewayServer` using `Bun.serve` with `websocket` handlers.
  3. Implement token-based authentication (Bearer token from config).
  4. Subscribe to `PluginManager` events and broadcast them to connected WS clients.
  5. Allow WS clients to send an `execute_command` message to trigger bridge actions.
- **Review Criteria:** WS client can authenticate and receive live game events.

## Phase 2: Maintenance & Engine Depth

### Task 3: Periodic Auto-Updater
- **Context:** Background gamedata updater.
- **Requirements:**
  1. Create `src/ts/addons/updater/service.ts`.
  2. Implement a background loop that polls a remote URL (configured in settings) every X hours.
  3. If gamedata hash differs, download and stage the new `gamedata.txt` in a temporary location.
  4. Implement a hook to replace the live file during map change/restart.
- **Review Criteria:** Service correctly identifies remote changes and stages files.

### Task 4: Advanced Entity Discovery & Easy-Protobuf
- **Context:** Enhancing motor interaction.
- **Requirements:**
  1. Add `GetEntitiesInRadius` and `FindEntityByClassname` to `PluginContext`.
  2. Implement the C++ side actions in `src/cpp/plugin.cpp` (or mock them for now in TS).
  3. Create `src/ts/shared/protobuf.ts` providing a `SendProtobuf(msgName, data)` helper.
  4. Ensure JSON-to-Protobuf translation is handled before sending to the bridge.
- **Review Criteria:** Plugins can find entities and send custom protobufs using JSON.

## Phase 3: Spatial Awareness (NavMesh)

### Task 5: NavMesh Mirroring & Worker Pathfinding
- **Context:** AI navigation API.
- **Requirements:**
  1. Update bridge protocol to support `navmesh_dump` event.
  2. Implement `src/ts/addons/ai/navmesh.ts` to parse the binary dump into a traversable graph.
  3. Create a Bun Worker `src/ts/addons/ai/pathfinder.worker.ts` for A* calculations.
  4. Expose `NavMesh.GetPath(start, end): Promise<Vector[]>` to plugins.
- **Review Criteria:** Pathfinding returns a valid set of coordinates without blocking the main thread.
