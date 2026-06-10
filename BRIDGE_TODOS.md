# Bridge & Core Implementation Todo List

This list tracks the implementation of technical features defined in `ROADMAP.md` that are currently missing or incomplete in the codebase.

## 🟢 Phase 1: Foundations (Core & Types)
- [x] **Task 1: Comprehensive Event Hooking & Typing**
    - Implement C++ hooks for common events: `player_spawn`, `player_death`, `round_start`, `round_end`.
    - Map these events to the MsgPack bridge and ensure full TypeScript typing in `src/ts/shared/types/events.ts`.
- [x] **Task 2: Standardized Error Handling**
    - Create a `MetaBunError` base class and specialized errors for `BridgeError`, `PluginError`.
    - Update `index.ts` and `PluginContext` to use these for better debugging.

## 🟡 Phase 2: Advanced Natives & Tools
- [x] **Task 3: Advanced Entity Management (Natives)**
    - Implement C++ logic for `GetEntityProp`, `SetEntityProp`, and `CreateEntity`.
    - Expose these as TS natives in `src/ts/natives/entities.ts`.
- [x] **Task 4: Bridge Debugging Mode**
    - Implement a detailed log toggle in `MetaBunApp` to inspect all MsgPack packets.
    - Add a `debug` level to `LogMessage` that actually shows bridge traffic.
- [x] **Task 5: Dynamic Advanced Menu System**
    - Expand `Menu` class to support multi-page navigation and dynamic callbacks without boilerplate.

## 🔴 Refactoring & Performance
- [x] **Task 6: MsgPack Consolidation**
    - Remove legacy `ndjson` and `length_prefixed_json` protocols from `index.ts`.
    - Make `length_prefixed_msgpack` the only supported protocol for maximum performance.
