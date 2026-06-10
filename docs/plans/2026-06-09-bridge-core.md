# Bridge Core Command & Chat System Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a two-way communication channel between Metamod:Source (C++) and Bun (TypeScript) to capture chat/console commands and execute server commands.

**Architecture:** A C++ Metamod plugin will act as a TCP client connecting to the Bun server. It will hook `ClientCommand` for console commands and `say`/`say_team` for chat commands, forwarding them via MsgPack. It will also listen for incoming commands from Bun to execute them using the Source Engine's `ServerCommand`.

**Tech Stack:** C++, Metamod:Source SDK, SourceHook, MsgPack-C (or simplified binary protocol).

---

### Task 1: C++ Project Boilerplate

**Files:**
- Create: `metamod-plugin/src/plugin.cpp`
- Create: `metamod-plugin/src/plugin.h`
- Create: `metamod-plugin/CMakeLists.txt`

**Step 1: Create basic plugin header**
Define the `MetaBunBridge` class inheriting from `ISmmPlugin`.

**Step 2: Create plugin implementation boilerplate**
Implement `Load`, `Unload`, `AllPluginsLoaded` and basic Metamod macros.

**Step 3: Create CMakeLists.txt**
Set up the build system to include Metamod and Source SDK headers.

**Step 4: Commit**
```bash
git add metamod-plugin/
git commit -m "feat: initial metamod plugin boilerplate"
```

### Task 2: TCP Client & Communication Layer

**Files:**
- Modify: `metamod-plugin/src/plugin.h`
- Modify: `metamod-plugin/src/plugin.cpp`

**Step 1: Implement Socket Connection**
Add a background thread or async socket logic to connect to the Bun server (port 27013).

**Step 2: Implement MsgPack Serialization/Deserialization**
Add logic to package game events and unwrap commands from Bun.

**Step 3: Commit**
```bash
git commit -m "feat: bridge communication layer"
```

### Task 3: Capture Console Commands

**Files:**
- Modify: `metamod-plugin/src/plugin.cpp`

**Step 1: Hook IVEngineServer::ClientCommand**
Use SourceHook to intercept client commands.

**Step 2: Forward Command to Bun**
When a command is captured, send a `PlayerCommand` event to the bridge.

**Step 3: Commit**
```bash
git commit -m "feat: capture console commands"
```

### Task 4: Capture Chat Messages

**Files:**
- Modify: `metamod-plugin/src/plugin.cpp`

**Step 1: Hook "say" and "say_team"**
Register hooks for chat commands to capture text before it's processed.

**Step 2: Forward Chat to Bun**
Send `PlayerChat` event to the bridge.

**Step 3: Commit**
```bash
git commit -m "feat: capture chat messages"
```

### Task 5: Execute Server Commands from Bun

**Files:**
- Modify: `metamod-plugin/src/plugin.cpp`

**Step 1: Handle "command" action from Bun**
Listen for `{ action: "command", cmd: "..." }` and call `engine->ServerCommand(cmd)`.

**Step 2: Commit**
```bash
git commit -m "feat: execute server commands from bridge"
```
