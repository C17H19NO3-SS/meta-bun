# MetaBun Architecture Refactor Design

**Date:** 2026-06-04
**Topic:** IPC Modernization, Engine Synchronization, and Async Safety

## 1. Overview
This document outlines the architectural refactoring of the MetaBun framework to address critical flaws identified in the initial design. The primary goals are to eliminate network overhead, achieve perfect tick synchronization with the Source engine, and prevent race conditions arising from decoupled asynchronous tasks and plugin hot-reloads.

## 2. IPC Modernization: Transition to Local Sockets
**Problem:** The original design relied on TCP sockets (`127.0.0.1:8080`) for Inter-Process Communication (IPC) between the C++ Metamod plugin and the Bun runtime. For a high-frequency game loop (128 ticks/sec per player), TCP introduces unnecessary network stack overhead, framing complexity, and latency.

**Solution:** 
Transition the IPC layer to use Operating System native local sockets.
- **Linux:** Unix Domain Sockets (`ipc://` or file paths like `/tmp/metabun.sock`).
- **Windows:** Named Pipes.
- **Implementation:** The `Bridge` configuration will accept a local file path instead of a port. `Bun.listen()` natively supports Unix sockets. In Dockerized environments, this socket file can be shared between containers via volumes if necessary, though typical deployment will have both processes in the same container.

## 3. Synchronization: The "Slave" Clock Model
**Problem:** Bun maintained its own drift-corrected `setTimeout` loop to simulate 128 ticks per second and calculate `engine_time`. This parallel clock guarantees eventual desynchronization when the actual game engine experiences lag, pauses, or varying load.

**Solution:**
Adopt a strict "Slave" synchronization model.
- **Remove Virtual Clock:** The `TickLoop` and related `setTimeout` mechanics in `src/ts/index.ts` will be completely removed.
- **Engine-Driven Ticks:** The C++ Metamod plugin becomes the sole source of truth. It will emit a `GameFrame` event on every engine tick.
- **Absolute Time:** Every `GameFrame` payload will include the absolute `tick_count` and `engine_time` directly from the Source engine.
- **Bun State:** The `MetaBunApp` will update its internal `currentEngineTime` and `currentTick` solely based on these incoming messages. `GetEngineTime()` will return this synchronized value.

## 4. Asynchronous Task Safety & Hot-Reloads
**Problem:** When a plugin initiates an asynchronous task (e.g., a database query via `Task.Run`), the game state may change before the task resolves. A player might disconnect and a new player might take their slot (`client_index`). Furthermore, if a plugin hot-reloads, "orphan" callbacks from the old plugin version might execute, attempting to modify the game state.

**Solution:**
- **Decoupled Execution:** Async tasks remain decoupled ("fire-and-forget" from the engine's perspective).
- **Engine UserID Verification:** Native API calls that target players (e.g., `SlapPlayer`, `KickClient`) must validate against the engine's unique `UserID` rather than just the volatile `client_index` (slot 1-64). When an async callback resumes and issues a command, the framework verifies the `UserID` is still active. If not, the command is silently discarded, preventing actions on the wrong entity.
- **Context Invalidation:** When a plugin is hot-reloaded, its `PluginContext` is marked as destroyed/disposed. If an orphan async callback from the old version resolves and attempts to use the Native API through its stale context, the framework will reject the call, preventing side effects from outdated plugin code.
