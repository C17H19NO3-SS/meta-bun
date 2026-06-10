# Design Doc: CSS-Inspired Command System

## Overview
This design implements a robust, unified command handling system for the `meta-bun` bridge, inspired by CounterStrikeSharp (CSS). It features automatic engine-level registration, unified chat/console triggers, and advanced targeting filters.

## Architecture

### 1. Engine Registration (C++ Bridge)
- **Automatic ConCommand Creation:** When a plugin registers a command in Bun, the bridge will dynamically register a real `ConCommand` in the Source 2 engine.
- **Unified Dispatch:** Both the engine command and chat triggers will route through a single internal handler in C++ that notifies the Bun application.
- **Metadata Support:** Commands will include descriptions and help strings for engine-level autocompletion.

### 2. Unified Command Handling (Bun/TS)
- **Trigger Detection:** The system handles `!` (public) and `/` (silent) prefixes automatically.
- **Command Aliasing:** Automatic mapping between `sm_` prefixed commands and their non-prefixed counterparts.
- **Force Silent:** A new flag `silent: true` in command registration allows hiding a command from chat even if triggered with `!`.

### 3. Argument Parsing & Targeting
- **Smart Split:** Arguments are parsed respecting quotes (e.g., `!kick "Player Name" "reason"` becomes `["Player Name", "reason"]`).
- **Target Filters (@all, @me, etc.):** Integration into `PlayerManager` to resolve special target patterns into player lists.
- **Context-Aware Replies:** `ReplyToCommand` automatically detects if the source was Chat or Console and responds appropriately.

## Technical Components

### C++ Changes (`src/cpp/plugin.cpp`)
- Update `Hook_DispatchConCommand` to better handle chat triggers.
- Implement a robust dynamic command registration system using `icvar->RegisterConCommand`.
- Maintain a map of registered commands to handle Bun-side unregistration.

### Bun Changes (`src/ts/`)
- **PluginManager:** Extend `RegConsoleCmd` to accept options (flags, description, silent).
- **Bridge:** Update protocol to carry command context (Source, Original String).
- **PlayerManager:** Add `ResolveTargets(pattern: string)` for handling `@` filters.

## Success Criteria
- Commands registered in Bun show up in game console autocomplete.
- `/command` is hidden from chat (Superceded).
- `!command` with `silent: true` is hidden from chat.
- Both `!cmd` and `sm_cmd` in console trigger the same Bun callback.
- `@all` correctly identifies all players in target-filtered commands.
