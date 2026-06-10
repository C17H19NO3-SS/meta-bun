# MetaBun CSS Features Integration Design

## Overview
This design document outlines the architecture for integrating advanced Counter-Strike Sharp (CSS) equivalent features into MetaBun, while explicitly maintaining the two-process (C++ Bridge to Bun) architecture and excluding immediate IPC (Unix Domain Sockets) acceleration.

## 1. SchemaGen (Build-Time Static Type Generation)
**Goal:** Provide zero-overhead, perfect IDE autocomplete and type-safety for entity properties.
- **Data Flow:**
  1. **Dump Phase:** Upon startup, the MetaBun C++ bridge scans the CS2 Schema System and exports all classes, properties, and offsets to a `schema.json` file.
  2. **Build-Time Generation:** Developers run `bun run generate:schema` in the CLI. This tool parses the JSON and emits static TypeScript proxy classes into `src/ts/generated/`.
  3. **Usage:** Proxy classes wrap Entity IDs. When a developer executes `player.Health = 100`, the TypeScript setter natively translates this into a `SetEntityProp` network payload sent across the bridge.
- **Error Handling:** Schema mismatches or malformed JSONs are caught during the build step (CLI), preventing runtime errors.

## 2. Rule-Based Hook System (AST Expression Trees)
**Goal:** Handle synchronous events (like `TakeDamage`) with zero latency, bypassing the TCP round-trip.
- **Data Flow:**
  1. **Registration:** During plugin load, the developer constructs a TypeScript Abstract Syntax Tree (AST) representing a condition (e.g., `Rule.And(Rule.Eq("attacker", 5), Rule.Gt("damage", 50))`) and registers it with an action (`HookAction.Block`).
  2. **Bridge Transfer:** This AST is serialized and sent to the C++ bridge.
  3. **Synchronous Execution:** C++ parses the AST into memory. When the native event (`TakeDamage`) fires, C++ evaluates the local AST. If it matches, the event is intercepted (`MRES_SUPERCEDE`) immediately at the engine level without asking Bun.
- **Error Handling:** C++ validates the AST on registration and rejects unsupported operators, throwing a TypeScript exception early.

## 3. High-Level UI Components (UserMessages)
**Goal:** Abstract raw Protobuf `UserMessage` structures into clean, OOP-style UI components.
- **Data Flow:**
  1. **Abstraction:** Creation of classes like `CenterHtmlMenu`, `ChatMenu`, and `HudMessage` in TypeScript.
  2. **Usage:** `const menu = new CenterHtmlMenu("<h1>Hello</h1>"); menu.Show(player);`
  3. **Bridge Transfer:** The `Show()` method calculates the correct `UserMessage` payload and sends a structured action to C++. The C++ bridge simply forwards this payload to `IGameEventManager2::SendUserMessage`.
  4. **Interactivity:** Menu selections trigger silent commands sent back from CS2, which the MetaBun UI classes intercept to fire TypeScript callbacks.

## 4. Dynamic Localization (i18n)
**Goal:** Provide explicit, scalable player-specific translations using the npm ecosystem.
- **Data Flow:**
  1. **Tracking:** MetaBun tracks `ClientLanguage` on player connection.
  2. **Storage:** Standard `.json` files in a `translations/` directory (e.g., `tr.json`, `en.json`).
  3. **Usage:** Explicit translation function: `player.PrintToChat(t("welcome_msg", player, { name: player.Name }));`
  4. **Processing:** The `t()` function looks up the player's language, retrieves the string, interpolates variables (like `{name}`), and emits the finalized string over the bridge to the engine.
- **Performance:** In-memory translation parsing entirely on the Bun side introduces zero overhead to the CS2 engine.