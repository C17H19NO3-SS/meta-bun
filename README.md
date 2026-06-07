# MetaBun — Bun-Powered Metamod Plugin Framework

> A high-performance, TypeScript-first plugin system for Source-engine game servers.  
> Connects a C++ Metamod plugin to a Bun runtime via a low-latency TCP socket bridge.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Plugin Development](#plugin-development)
5. [API Reference](#api-reference)
6. [Configuration](#configuration)
7. [Testing](#testing)
8. [Project Structure](#project-structure)

---

## Overview

MetaBun is a modular plugin framework for Counter-Strike 2 (and other Source-engine) game servers. It consists of two layers:

- **C++ Side (Metamod Plugin):** Hooks into game engine events and communicates with the Bun runtime via a local TCP socket.
- **Bun Side (TypeScript Core):** Receives events, manages plugins, players, admins, and dispatches commands back to the engine.

### Key Features

| Feature | Description |
|---------|-------------|
| 🚀 **128 Tickrate Loop** | Drift-corrected game loop emitting `GameFrame` at 128 ticks/second |
| 🔌 **Hot-Reload** | Plugins are file-watched and reloaded on save without server restart |
| 🧵 **Non-blocking Tasks** | `Task.Run()` uses `queueMicrotask` for zero-delay async operations |
| 🌍 **GeoIP Lookup** | IP-to-country resolution via binary-search local database |
| 🌐 **Multi-Protocol Bridge** | NDJSON, Length-Prefixed JSON, and MessagePack protocols supported |
| 💾 **SQLite Persistence** | Player stats and ban records persisted across sessions |
| 🗣️ **Translations** | Multilingual plugin messages via JSON locale files |
| 🛡️ **Admin System** | Flag-based permission checking with immunity levels |
| 📋 **Interactive Menus** | SourceMod-style dynamic client menus |
| 🗳️ **Voting System** | Server-wide vote creation with timed callbacks |

---

## Architecture

```
┌─────────────────────┐          TCP Socket          ┌─────────────────────────┐
│   Game Server       │ ◄──────────────────────────► │   Bun Runtime           │
│   (Metamod C++)     │   GameEvent / GameAction      │   (meta-bun core)       │
│                     │   (NDJSON / MsgPack)          │                         │
│  • Hook events      │                               │  • MetaBunApp           │
│  • Execute commands │                               │  • PluginManager        │
│  • Send menus       │                               │  • PlayerManager        │
└─────────────────────┘                               │  • AdminManager         │
                                                      │  • BanManager           │
                                                      │  • DatabaseManager      │
                                                      │  • TranslationManager   │
                                                      │  • GeoIPService         │
                                                      └─────────────────────────┘
```

### Event Flow

1. Game event fires (e.g., player kills, chat message)
2. C++ Metamod hook serializes it as JSON/MsgPack over TCP
3. `MetaBunApp` receives and parses the payload
4. `PluginManager` dispatches the event to all registered listeners
5. Plugin callback executes within its isolated `PluginContext`
6. Any commands/messages are sent back via `Bridge.Send()`

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.3.14+
- A running Source-engine game server with Metamod loaded

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd meta-bun

# Install dependencies
bun install
```

### Development

```bash
# Run tests
bun test

# Build distribution bundle
bun run build

# Start the bridge listener (standalone)
BRIDGE_PORT=8080 BRIDGE_PROTOCOL=ndjson bun run src/ts/index.ts
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_PORT` | `8080` | TCP port for C++ bridge connection |
| `BRIDGE_PROTOCOL` | `ndjson` | Protocol: `ndjson`, `length_prefixed_json`, `length_prefixed_msgpack` |

---

## Plugin Development

### Creating a Plugin

All plugins must extend `BasePlugin` and be placed in the `plugins/` directory. They are hot-reloaded automatically when files change.

```typescript
// plugins/my-plugin.ts
import { BasePlugin, type IGameBridge, Task } from "meta-bun/core";

export default class MyPlugin extends BasePlugin {
  public override name = "MyPlugin";
  public override version = "1.0.0";
  public override author = "YourName";

  public override async OnLoad(game: IGameBridge) {
    // Register a chat command (!hello / sm_hello)
    game.RegConsoleCmd("sm_hello", (client, args) => {
      game.PrintToChat(client, "{Green}Hello, {Yellow}" + game.GetClientName(client) + "{Default}!");
    }, "Greet the player");

    // Hook a game event
    game.HookEvent("PlayerDeath", (data) => {
      game.PrintToChatAll(`{Red}${data.victim} was eliminated!`);
    });

    // Non-blocking async operation
    Task.Run(async () => {
      const result = await fetch("https://api.example.com/data");
      const json = await result.json();
      game.LogMessage(`Fetched: ${JSON.stringify(json)}`);
    });

    game.LogMessage("MyPlugin loaded successfully!");
  }

  public override async OnUnload() {
    console.log("[MyPlugin] Unloaded.");
  }
}
```

### Chat Color Tags

Use color tags in messages to colorize chat output:

| Tag | Color |
|-----|-------|
| `{Default}` | Default |
| `{Red}` | Red |
| `{Green}` | Green |
| `{Lime}` | Lime |
| `{Yellow}` | Yellow |
| `{Gold}` | Gold |
| `{Blue}` | Blue |
| `{DarkBlue}` | Dark Blue |
| `{Purple}` | Purple |
| `{Cyan}` | Cyan |
| `{Grey}` | Grey |

### Permission Flags

Admin flags are single letters defined in `configs/admins.json`:

| Flag | Description |
|------|-------------|
| `a` | Reserved slots / VIP access |
| `b` | Generic permissions |
| `c` | Admin commands (slap, kick, menu) |
| `d` | Ban management |
| `z` | Root/superadmin — all permissions |

### State Retention Across Hot-Reloads

```typescript
// Save state so it persists across hot-reloads
game.SetState("counter", 0);

// Retrieve state (or default value if first load)
const count = game.GetState("counter", 0);
```

### Async Tasks

Use `Task.Run()` for any I/O-heavy or async operations. It schedules via `queueMicrotask`, preventing tick delays:

```typescript
// ✅ Correct — async function
Task.Run(async () => {
  const data = await db.query("SELECT * FROM players");
});

// ❌ Wrong — synchronous functions throw a runtime error
Task.Run(() => {
  doSomethingSync(); // TypeError: must return a Promise
});
```

### Translations

Create JSON files in the `translations/` folder:

```json
// translations/en.json
{
  "stats_info": "Player: {0} | Kills: {1} | Deaths: {2}"
}
```

Load and use in your plugin:

```typescript
game.LoadTranslations("my-plugin");
game.TPrintToChat(client, "stats_info", playerName, kills, deaths);
```

---

## API Reference

### `IGameBridge` — Plugin API

The complete interface available to every plugin via the `game` parameter in `OnLoad`.

#### Core

| Method | Description |
|--------|-------------|
| `HookEvent(event, callback)` | Listen for a named game event |
| `ServerCommand(cmd)` | Execute a server console command |
| `RegConsoleCmd(cmd, callback, desc?)` | Register a chat/console command |
| `LogMessage(msg)` | Log to terminal and log files |
| `CreateTimer(ms, cb, repeat?)` | Schedule a delayed or repeating callback |
| `KillTimer(timer)` | Cancel an active timer |
| `CreateMenu(title, callback)` | Create an interactive client menu |

#### Messaging

| Method | Description |
|--------|-------------|
| `PrintToChat(client, msg)` | Send colored message to one client |
| `PrintToChatAll(msg)` | Send colored message to all clients |
| `ReplyToCommand(client, msg)` | Reply to command (chat or console) |
| `TPrintToChat(client, key, ...args)` | Send localized translated message |
| `LoadTranslations(filename)` | Load a translation phrase file |

#### Client Info

| Method | Description |
|--------|-------------|
| `GetMaxClients()` | Max server client slots |
| `GetClientCount(inGameOnly?)` | Count of connected clients |
| `GetClientName(client)` | Client's display name |
| `GetClientAuthId(client)` | Client's SteamID |
| `GetClientUserId(client)` | Client's engine UserID |
| `GetClientHealth(client)` | Client's current HP |
| `GetClientMoney(client)` | Client's current money |
| `GetClientTeam(client)` | Client's team index |
| `IsClientInGame(client)` | Whether client is active in game |
| `IsPlayerAlive(client)` | Whether client is alive |
| `GetClientIP(client)` | Client's IP address |
| `GetClientCountry(client)` | Client's country via GeoIP |

#### Actions

| Method | Description |
|--------|-------------|
| `SlapPlayer(client, damage)` | Slap a client with optional damage |
| `TeleportEntity(client, x, y, z)` | Teleport to 3D coordinates |
| `ChangeClientTeam(client, team)` | Change a client's team |
| `RespawnPlayer(client)` | Force respawn a player |
| `KickClient(client, reason?)` | Kick from server |
| `BanClient(steamId, reason, admin, duration)` | Ban by SteamID |
| `RemoveBan(steamId)` | Remove ban record |

#### Weapons & Inventory

| Method | Description |
|--------|-------------|
| `GivePlayerItem(client, item)` | Give weapon/item to client |
| `RemovePlayerItem(client, item)` | Remove weapon/item from client |
| `GetClientWeapon(client)` | Currently held weapon name |
| `SetWeaponAmmo(client, weapon, ammo)` | Set weapon ammo |

#### Entity Properties

| Method | Description |
|--------|-------------|
| `SetEntityGravity(client, gravity)` | Set gravity scale (1.0 = default) |
| `SetEntityMoveType(client, movetype)` | Set movement physics type |
| `SetEntityHealth(client, health)` | Set health directly |
| `SetEntityModel(client, model)` | Change player model |
| `SetEntityRenderColor(client, r, g, b, a)` | Set RGBA render color |
| `EmitSoundToClient(client, sound)` | Play sound to one client |
| `EmitSoundToAll(sound)` | Play sound to all clients |

#### Permissions

| Method | Description |
|--------|-------------|
| `CheckCommandAccess(client, cmd, flags)` | Check if client has permission flags |
| `GetUserFlagBits(client)` | Get all flags assigned to client |

#### Voting

| Method | Description |
|--------|-------------|
| `CreateVote(question, options, callback, durationMs?)` | Start a timed server vote |

#### Engine Metrics

| Method | Description |
|--------|-------------|
| `GetEngineTime()` | Simulated engine uptime in seconds |
| `GetTickrate()` | Server tickrate (128) |
| `GetTickInterval()` | Seconds per tick (1/128 ≈ 0.0078s) |
| `GetBridgeLatency()` | Bun ↔ C++ latency in ms |

#### Logging

| Method | Description |
|--------|-------------|
| `LogToFile(filename, message)` | Append to a file in `logs/` directory |

#### State Retention

| Method | Description |
|--------|-------------|
| `GetState<T>(key, initial)` | Retrieve plugin state across reloads |
| `SetState<T>(key, value)` | Save plugin state across reloads |

---

### `players` — Player Manager

Accessible via `game.players` or directly via native imports.

| Method | Description |
|--------|-------------|
| `Get(index)` | Get player by client index |
| `FindByName(name)` | Search by display name |
| `FindBySteamId(steamId)` | Search by SteamID |
| `GetAll()` | All registered players |
| `GetClientsByTeam(team)` | All players on a team |
| `GetAliveClients()` | All alive players |
| `GetInGameClients()` | All in-game players |

### `Player` — Individual Player Instance

Each player exposes:

| Method | Description |
|--------|-------------|
| `GetHealth()` | Current health |
| `GetArmor()` | Current armor |
| `GetMoney()` | Current money |
| `GetTeam()` | Current team enum |
| `GetKills()` | Session kills |
| `GetDeaths()` | Session deaths |
| `GetAssists()` | Session assists |
| `GetTotalKills()` | Persistent total kills |
| `GetTotalDeaths()` | Persistent total deaths |
| `GetTotalAssists()` | Persistent total assists |
| `GetHeadshots()` | Headshot count |
| `GetDamage()` | Total damage dealt |
| `GetMVPs()` | MVP count |
| `GetPlaytime()` | Total playtime in seconds |
| `GetIdleTime()` | Seconds since last activity |
| `GetCountry()` | Country via GeoIP |
| `IsAlive()` | Whether alive |
| `IsBot()` | Whether a bot |
| `IsMuted()` | Whether muted from chat |
| `IsGagged()` | Whether gagged (text blocked) |
| `IsBanned()` | Async ban check |
| `HasFlag(flag)` | Check admin flag |
| `CanTarget(target)` | Whether can target another player |
| `Mute() / Unmute()` | Toggle voice mute |
| `Gag() / Ungag()` | Toggle text gag |
| `Silence() / Unsilence()` | Mute + Gag together |

---

### `Task` — Non-blocking Async Task Runner

```typescript
import { Task } from "meta-bun/core";

Task.Run(async () => {
  // Any async I/O — DB queries, HTTP calls, file reads
  await someAsyncOperation();
});
```

- Uses `queueMicrotask` internally — **zero timer-wheel delay**
- Throws a `TypeError` if a synchronous function is passed
- Prevents game tick blocking

---

## Configuration

### `configs/admins.json`

```json
{
  "STEAM_0:1:12345678": "z",
  "STEAM_0:0:87654321": {
    "flags": "abcd",
    "immunity": 50
  }
}
```

### `configs/geoip.json`

IP range database for country lookups. Auto-generated with defaults on first run.

```json
[
  { "start": "1.1.0.0", "end": "1.1.255.255", "country": "Turkey" },
  { "start": "8.8.8.0", "end": "8.8.8.255", "country": "United States" }
]
```

### `translations/<lang>.json`

```json
{
  "stats_info": "Player: {0} | Kills: {1} | Deaths: {2}",
  "welcome": "Welcome to the server, {0}!"
}
```

---

## Testing

```bash
# Run all 53 tests
bun test

# Run specific test file
bun test test/unit/player.test.ts
bun test test/integration/advanced-features.test.ts
```

### Test Coverage

| Test Suite | Tests | Description |
|-----------|-------|-------------|
| `advanced-features.test.ts` | 4 | Integration: protocols, tickrate, async tasks |
| `menu.test.ts` | 2 | Menu creation, voting system |
| `translations.test.ts` | 4 | Translation loading, formatting, fallbacks |
| `admin.test.ts` | 3 | Permission checks, immunity |
| `plugin-context.test.ts` | 6 | Context API, events, logging |
| `player.test.ts` | 5 | Stats, inventory, idle detection |

---

## Project Structure

```
meta-bun/
├── plugins/                    # User-created plugin files (hot-reloaded)
│   └── admin-tools.ts          # Example admin plugin
├── src/ts/
│   ├── index.ts                # MetaBunApp entry point & tickrate loop
│   ├── admins/
│   │   ├── manager.ts          # AdminManager — flag & immunity management
│   │   └── bans.ts             # BanManager — ban/unban with DB integration
│   ├── network/
│   │   └── bridge.ts           # Bridge — TCP socket framing & protocols
│   ├── players/
│   │   ├── player.ts           # Player — session state & EventEmitter
│   │   └── manager.ts          # PlayerManager — collection & DB persistence
│   ├── plugin-system/
│   │   ├── manager.ts          # PluginManager — load/unload/hot-reload
│   │   ├── context.ts          # PluginContext — scoped API per plugin
│   │   └── menu.ts             # Menu — interactive client menu builder
│   ├── shared/
│   │   ├── context-store.ts    # AsyncLocalStorage plugin context store
│   │   ├── database.ts         # DatabaseManager — SQLite CRUD
│   │   ├── geoip.ts            # GeoIPService — IP-to-country binary search
│   │   ├── plugin.ts           # BasePlugin — abstract base class
│   │   ├── task.ts             # Task — queueMicrotask async runner
│   │   ├── translations.ts     # TranslationManager — i18n phrase loading
│   │   └── types/
│   │       ├── admin.ts        # IAdminManager interface
│   │       ├── bridge.ts       # IGameBridge, GameAction, IMenu interfaces
│   │       ├── enums.ts        # Team, Action enums
│   │       ├── events.ts       # GameEvent type definitions
│   │       ├── player.ts       # IPlayer, IPlayerManager interfaces
│   │       ├── plugin.ts       # IPlugin interface
│   │       └── weapon.ts       # Weapon type
│   └── natives/                # Native wrapper functions (module-scope API)
│       ├── index.ts            # Re-exports all natives
│       ├── core.ts             # Chat, logging, translation natives
│       ├── player.ts           # Player query/action natives
│       ├── console.ts          # Command registration natives
│       ├── events.ts           # Event hook natives
│       ├── menus.ts            # Menu creation natives
│       └── timers.ts           # Timer natives
├── configs/
│   ├── admins.json             # Admin SteamID flags and immunity levels
│   └── geoip.json              # IP range to country mapping database
├── translations/               # Language JSON files (en.json, tr.json, etc.)
├── logs/                       # Plugin log file output directory
├── test/
│   ├── integration/
│   │   └── advanced-features.test.ts
│   └── unit/
│       ├── admin.test.ts
│       ├── menu.test.ts
│       ├── player.test.ts
│       ├── plugin-context.test.ts
│       └── translations.test.ts
├── docs/                       # Architecture plans and design documents
├── package.json
└── tsconfig.json
```

---

## Bridge Protocols

The Bun ↔ C++ bridge supports three serialization protocols, configurable via `BRIDGE_PROTOCOL`:

| Protocol | Description | Use Case |
|----------|-------------|----------|
| `ndjson` | Newline-delimited JSON | Development / debugging |
| `length_prefixed_json` | 4-byte length header + JSON body | Reliable production JSON |
| `length_prefixed_msgpack` | 4-byte length header + MessagePack body | High-performance binary |

---

## License

Private repository. All rights reserved.
