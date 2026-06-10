# Roadmap Foundations & Advanced Features Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement missing core framework and bridge features defined in `ROADMAP.md` to reach Stage 2 maturity.

**Architecture:** We will extend the existing C++ bridge with additional SourceHook listeners and MsgPack emitters. On the TypeScript side, we will introduce specialized error handling, expand the native function set (especially for entities), and consolidate the network protocol.

**Tech Stack:** C++, Metamod:Source, SourceHook, TypeScript, Bun, MsgPack.

---

### Task 1: Comprehensive Event Hooking & Typing

**Files:**
- Modify: `src/cpp/plugin.h`
- Modify: `src/cpp/plugin.cpp`
- Modify: `src/ts/shared/types/events.ts`

**Step 1: Declare C++ Hooks**
Add `SH_DECL_HOOK` for `IGameEventManager2::FireGameEvent`.

**Step 2: Implement Event Capture**
In `plugin.cpp`, hook into the game event manager. When an event fires, check if it's one of the requested types (`player_spawn`, `player_death`, `round_start`, `round_end`) and forward it via MsgPack.

**Step 3: Update TS Types**
Ensure all forwarded events have exact interface definitions in `events.ts`.

**Step 4: Commit**
`feat: add comprehensive event hooking and typing`

### Task 2: Standardized Error Handling

**Files:**
- Create: `src/ts/shared/errors.ts`
- Modify: `src/ts/index.ts`
- Modify: `src/ts/plugin-system/context.ts`

**Step 1: Define Error Classes**
Create `MetaBunError`, `BridgeError`, and `PluginError` extending `Error`.

**Step 2: Implement Error usage**
Wrap socket operations and plugin loads in try-catch blocks that use these new error types.

**Step 3: Commit**
`feat: implement standardized error handling`

### Task 3: Advanced Entity Management (Natives)

**Files:**
- Modify: `src/cpp/plugin.cpp`
- Create: `src/ts/natives/entities.ts`
- Modify: `src/ts/natives.ts`

**Step 1: Implement C++ Entity Accessors**
Add `GetEntityProp` and `SetEntityProp` handling in `ProcessMessage`. Use `IServerUnknown` and `CBaseEntity` pointers.

**Step 2: Create TS Entity Natives**
Expose `GetEntityProp`, `SetEntityProp`, and `CreateEntity` in a new `entities.ts` native file.

**Step 3: Commit**
`feat: add advanced entity management natives`

### Task 4: Bridge Debugging Mode

**Files:**
- Modify: `src/ts/index.ts`
- Modify: `src/ts/network/bridge.ts`

**Step 1: Add Debug Flag**
Add a `debug` property to `MetaBunApp` settings.

**Step 2: Implement Traffic Logging**
In `Bridge.Send` and `HandlePayload`, if debug is enabled, log the raw hex or decoded JSON of the MsgPack packet.

**Step 3: Commit**
`feat: add bridge debugging mode`

### Task 5: Dynamic Advanced Menu System

**Files:**
- Modify: `src/ts/plugin-system/menu.ts`

**Step 1: Implement Pagination Logic**
Add `SetItemsPerPage` and automatic "Next/Back" item injection in the `Display` method.

**Step 2: Commit**
`feat: advanced menu system with pagination`

### Task 6: MsgPack Consolidation

**Files:**
- Modify: `src/ts/index.ts`
- Modify: `src/ts/network/bridge.ts`

**Step 1: Remove Legacy Protocols**
Delete all logic related to `ndjson` and `length_prefixed_json`.

**Step 2: Force MsgPack**
Make `length_prefixed_msgpack` the only way to communicate.

**Step 3: Commit**
`refactor: consolidate bridge protocol to msgpack`
