# CSS-Inspired Command System Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implement a unified, CSS-inspired command handling system with engine-level registration, chat/console synchronization, and advanced targeting.

**Architecture:** Bun-side commands are registered as real Source 2 `ConCommand`s via the C++ Bridge. The bridge hooks `say`/`say_team` to translate chat triggers (`!`, `/`) into engine commands or Bun actions.

**Tech Stack:** C++, TypeScript, Bun, Metamod:Source.

---

### Task 1: C++ Bridge - Dynamic ConCommand Registration

**Files:**
- Modify: `src/cpp/plugin.cpp`
- Modify: `src/cpp/plugin.h`

**Step 1: Update `ProcessMessage` to handle `register_command` with flags and description.**
- Enhance the `register_command` case in `ProcessMessage` to extract `description` and `flags` (if any).
- Use `icvar->RegisterConCommand` to create a real engine command.

**Step 2: Update `MetaBunBridge` class to track registered commands for cleanup.**
- Add a `std::map` or similar structure to `plugin.h` to store `ConCommand` references.

**Step 3: Implement `UnregisterCommand` logic.**
- Ensure commands are properly unregistered when a plugin is unloaded in Bun.

**Step 4: Verify Registration.**
- Add a temporary test command in Bun and check if it appears in `help` in the game console.

**Step 5: Commit.**
```bash
git add src/cpp/plugin.cpp src/cpp/plugin.h
git commit -m "feat(bridge): implement dynamic engine command registration"
```

---

### Task 2: C++ Bridge - Chat Hook & Silent Triggers

**Files:**
- Modify: `src/cpp/plugin.cpp`

**Step 1: Refactor `Hook_DispatchConCommand` for `say` / `say_team`.**
- Implement detection for `!` and `/`.
- Add logic to check if a command is "Force Silent".

**Step 2: Implement `MRES_SUPERCEDE` for Silent Triggers.**
- If message starts with `/` or has the silent flag, return `MRES_SUPERCEDE` to hide from chat.

**Step 3: Protocol Update.**
- Update the payload sent to Bun to include `source` (chat/console) and the original command string.

**Step 4: Commit.**
```bash
git add src/cpp/plugin.cpp
git commit -m "feat(bridge): add silent chat triggers and unified command dispatch"
```

---

### Task 3: Bun/TS - PluginManager & RegConsoleCmd Extension

**Files:**
- Modify: `src/ts/plugin-system/manager.ts`
- Modify: `src/ts/shared/types/bridge.ts`
- Modify: `src/ts/shared/types/plugin.ts`

**Step 1: Update Type Definitions.**
- Add `CommandOptions` interface with `description`, `flags`, and `silent`.

**Step 2: Extend `RegConsoleCmd` in `PluginManager`.**
- Update the signature to accept `CommandOptions`.
- Send the new options to the bridge in the `register_command` action.

**Step 3: Unified Handler Update.**
- Update the `ConsoleCommand` and `PlayerChat` event handlers to correctly route to the same command handler.

**Step 4: Commit.**
```bash
git add src/ts/plugin-system/manager.ts src/ts/shared/types/bridge.ts src/ts/shared/types/plugin.ts
git commit -m "feat(bun): extend RegConsoleCmd with advanced options"
```

---

### Task 4: Bun/TS - PlayerManager Targeting Filters

**Files:**
- Modify: `src/ts/players/manager.ts`
- Modify: `src/ts/shared/types/player.ts`

**Step 1: Implement `ResolveTargets` method.**
- Add logic to handle `@all`, `@me`, `@ct`, `@t`, `@alive`, `@dead`.

**Step 2: Integrate into `CommandCallback`.**
- (Optional but recommended) Add a helper or utility to easily resolve targets from command arguments.

**Step 3: Test Targets.**
- Create a test plugin that uses `@all` and verify it identifies all connected players.

**Step 4: Commit.**
```bash
git add src/ts/players/manager.ts src/ts/shared/types/player.ts
git commit -m "feat(bun): implement CSS-style targeting filters (@all, @me, etc.)"
```

---

### Task 5: Integration Test & Verification

**Files:**
- Create: `plugins/test-commands.ts`

**Step 1: Create a comprehensive test plugin.**
- Register a command with `silent: true`.
- Register a command with `@all` targeting.
- Verify both work from console and chat (public/silent).

**Step 2: Run Verification.**
- Use integration tests or manual check in the game environment.

**Step 3: Commit.**
```bash
git add plugins/test-commands.ts
git commit -m "test: add integration test for CSS-inspired command system"
```
