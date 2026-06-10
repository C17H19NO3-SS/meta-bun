# Bridge Core Command & Player Actions Design

**Date:** 2026-06-09
**Topic:** Implementation of Server Command Execution, Chat/Console Command Interception, and Native Player Actions.

## 1. Overview
This document outlines the design for establishing two-way communication between the C++ Metamod plugin and the TypeScript Bun runtime specifically for command handling and player actions. The goal is to create a robust, production-ready system without mock data, leveraging native C++ engine capabilities.

## 2. Command Interception (C++ -> TypeScript)
To handle user input from the game client, the C++ bridge will intercept all console and chat commands and forward them to the TypeScript runtime.

**Approach: Unconditional Interception**
- The C++ plugin will hook `IVEngineServer::ClientCommand` (or equivalent engine facilities) to capture all console inputs.
- It will also intercept chat messages (`say` and `say_team`).
- Every captured command or chat message will be packaged into a MsgPack payload and sent to Bun.
- **MsgPack Payload Example:**
  - Console: `{ action: "console_cmd", userid: 123, args: ["sm_slap", "1"] }`
  - Chat: `{ action: "chat_cmd", userid: 123, text: "!slap 1", teamOnly: false }`
- **Rationale:** This keeps the C++ side simpler by acting as a dumb forwarder. The TypeScript `CommandRegistry` will handle the logic of determining if a command exists and if the user has permission to execute it.

## 3. Player Actions & Server Commands (TypeScript -> C++)
When a TypeScript plugin needs to modify the game state (e.g., kick a player, execute a server command), it will send a specific action payload to the C++ bridge.

**Approach: Extended Action Switch-Case & Native API**
- The TypeScript bridge will send MsgPack payloads with specific action keys.
- **MsgPack Payload Example:**
  - `{ action: "server_cmd", cmd: "changelevel de_dust2" }`
  - `{ action: "kick_client", userid: 123, reason: "Rule violation" }`
  - `{ action: "slap_player", userid: 123, damage: 50 }`
- In `plugin.cpp`, the `ProcessMessage` function will use an extended `if-else if` block (or switch-case) based on the `action` string.
- Crucially, the C++ implementation will use **Native Metamod/Source Engine APIs** to perform these actions (e.g., `engine->ServerCommand()`, `engine->DisconnectClient()`, or direct `CBaseEntity` manipulation) rather than relying on executing console strings.
- **Rationale:** Direct API usage provides higher performance, better error handling, and tighter integration with the game engine compared to string-based console commands.

## 4. Communication Protocol
- All communication for these features will use the established **MsgPack** format over the local TCP socket to ensure low latency and reduced parsing overhead compared to JSON.
