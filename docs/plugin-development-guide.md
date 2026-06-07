# MetaBun — Plugin Development Guide

> Step-by-step guide for creating, configuring, and distributing MetaBun plugins.

---

## Table of Contents

1. [Plugin Lifecycle](#plugin-lifecycle)
2. [File Structure](#file-structure)
3. [Minimal Plugin Example](#minimal-plugin-example)
4. [Commands & Chat Triggers](#commands--chat-triggers)
5. [Hooking Events](#hooking-events)
6. [Menus & Voting](#menus--voting)
7. [Admin Permissions](#admin-permissions)
8. [Database & Persistence](#database--persistence)
9. [Translations & Localization](#translations--localization)
10. [Async Tasks](#async-tasks)
11. [Timers](#timers)
12. [GeoIP & IP Lookup](#geoip--ip-lookup)
13. [State Retention Across Hot-Reloads](#state-retention-across-hot-reloads)
14. [File Logging](#file-logging)
15. [Mute / Gag / Silence](#mute--gag--silence)
16. [AFK Detection](#afk-detection)
17. [Hot-Reload Behavior](#hot-reload-behavior)
18. [Best Practices](#best-practices)

---

## Plugin Lifecycle

```
plugins/my-plugin.ts saved
        │
        ▼
PluginManager detects change (fs.watch)
        │
        ▼
Old plugin OnUnload() called → PluginContext.Cleanup()
        │
        ▼
New module imported (cache-busted)
        │
        ▼
PluginContext created (scoped API)
        │
        ▼
OnLoad(game) called inside pluginContextStore.run()
        │
        ▼
Plugin active — commands/hooks/timers live
```

---

## File Structure

Place plugins in the `plugins/` directory. Any `.ts` or `.js` file is loaded automatically.

```
plugins/
├── admin-tools.ts      # Example — ships with MetaBun
├── my-plugin.ts        # Your plugin
└── another-plugin.ts   # Another plugin
```

Each plugin **must** have a default export that is a class extending `BasePlugin`.

---

## Minimal Plugin Example

```typescript
// plugins/hello-world.ts
import { BasePlugin, type IGameBridge } from "meta-bun/core";

export default class HelloWorld extends BasePlugin {
  public override name    = "HelloWorld";
  public override version = "1.0.0";
  public override author  = "YourName";

  public override async OnLoad(game: IGameBridge) {
    game.RegConsoleCmd("sm_hello", (client, args) => {
      const name = game.GetClientName(client);
      game.PrintToChat(client, `{Green}Hello, {Yellow}${name}{Default}!`);
    }, "Greet the calling player");

    game.LogMessage("HelloWorld plugin loaded!");
  }

  public override async OnUnload() {
    console.log("[HelloWorld] Unloaded.");
  }
}
```

Players type `!hello` in chat → they get a greeting.

---

## Commands & Chat Triggers

### Registering a Command

```typescript
game.RegConsoleCmd("sm_respawn", (client, args) => {
  // client = calling player index (0 = server console)
  // args   = remaining words after the command
  game.RespawnPlayer(client);
  game.PrintToChat(client, "{Green}You have been respawned!");
}, "Respawn yourself");
```

### How Chat Triggers Work

| Player Types | Mapped Command |
|-------------|----------------|
| `!respawn`  | `sm_respawn` |
| `/respawn`  | `sm_respawn` |
| `!sm_respawn` | `sm_respawn` |

The `sm_` prefix is automatically prepended when looking up chat triggers.

### Parsing Arguments

```typescript
game.RegConsoleCmd("sm_give", (client, args) => {
  if (args.length < 2) {
    game.ReplyToCommand(client, "Usage: !give <player_id> <item>");
    return;
  }
  const targetId = parseInt(args[0]!);
  const item = args[1]!;
  game.GivePlayerItem(targetId, item);
}, "Give item to player");
```

### Server Console vs Player

- `client === 0` means the server console ran the command
- Use `game.ReplyToCommand(client, msg)` to respond appropriately either way

---

## Hooking Events

```typescript
// PlayerDeath event
game.HookEvent("PlayerDeath", (data) => {
  const victim   = game.GetClientName(data.client as number);
  const attacker = game.GetClientName(data.attacker as number);
  const weapon   = data.weapon as string;
  const headshot = data.headshot as boolean;

  const msg = headshot
    ? `{Red}${attacker} headshot ${victim} with ${weapon}!`
    : `${attacker} killed ${victim} with ${weapon}`;

  game.PrintToChatAll(msg);
});

// Round start
game.HookEvent("RoundStart", (data) => {
  game.PrintToChatAll("{Gold}=== NEW ROUND ===");
});

// GameFrame — called 128 times per second
game.HookEvent("GameFrame", (data) => {
  const tick = data.tick as number;
  if (tick % 128 === 0) { // every ~1 second
    // periodic logic here
  }
});
```

### Available Events

See [Game Events](api-reference.md#game-events) for the full event list and field definitions.

---

## Menus & Voting

### Simple Menu

```typescript
game.RegConsoleCmd("sm_menu", (client, args) => {
  const menu = game.CreateMenu("Admin Actions", (c, info) => {
    if (info === "respawn") {
      game.RespawnPlayer(c);
    } else if (info === "slap") {
      game.SlapPlayer(c, 10);
      game.PrintToChat(c, "Slapped yourself!");
    }
  });

  menu.AddItem("respawn", "Respawn Me");
  menu.AddItem("slap",    "Slap Me (10 dmg)");
  menu.Display(client);
}, "Open action menu");
```

### Voting System

```typescript
game.RegConsoleCmd("sm_vote", (client, args) => {
  game.CreateVote(
    "Should we restart the round?",
    ["Yes", "No"],
    (results) => {
      const yes = results["Yes"] ?? 0;
      const no  = results["No"] ?? 0;
      if (yes > no) {
        game.PrintToChatAll("{Gold}Vote passed! Restarting...");
        game.ServerCommand("mp_restartgame 3");
      } else {
        game.PrintToChatAll("{Red}Vote failed.");
      }
    },
    15000  // 15 second vote duration
  );
}, "Start a round-restart vote");
```

---

## Admin Permissions

### Checking Access in a Command

```typescript
game.RegConsoleCmd("sm_kick", (client, args) => {
  // Require flag "c" (admin) or "z" (root)
  if (!game.CheckCommandAccess(client, "sm_kick", "c") &&
      !game.CheckCommandAccess(client, "sm_kick", "z")) {
    game.PrintToChat(client, "{Red}You don't have permission.");
    return;
  }

  const targetId = parseInt(args[0] ?? "-1");
  const reason   = args.slice(1).join(" ") || "Kicked by admin";
  game.KickClient(targetId, reason);
}, "Kick a player (admin only)");
```

### Flag Reference

| Flag | Permission |
|------|-----------|
| `a` | VIP / reserved slots |
| `b` | Generic |
| `c` | Basic admin actions |
| `d` | Ban management |
| `z` | Superadmin / root |

### Configuring Admins — `configs/admins.json`

```json
{
  "STEAM_0:1:12345678": "z",
  "STEAM_0:0:87654321": {
    "flags": "cd",
    "immunity": 50
  }
}
```

---

## Database & Persistence

MetaBun includes a built-in SQLite database. Player stats are automatically loaded on connect and saved on disconnect.

### Accessing Stats in a Plugin

```typescript
game.RegConsoleCmd("sm_mystats", (client, args) => {
  const player = game.players.Get(client);
  if (!player) return;

  game.PrintToChat(client,
    `{Gold}Your Stats: {Green}K:${player.GetTotalKills()} ` +
    `{Red}D:${player.GetTotalDeaths()} ` +
    `{Yellow}A:${player.GetTotalAssists()}`
  );
}, "Show your persistent stats");
```

### What Gets Saved Automatically

- `total_kills`, `total_deaths`, `total_assists`
- `total_headshots`, `total_damage`, `total_mvps`
- `total_playtime` (seconds)
- `is_muted`, `is_gagged`

Stats accumulate (add up) across sessions in the database.

---

## Translations & Localization

### Step 1: Create Locale Files

```json
// translations/en.json
{
  "welcome_msg":  "Welcome to the server, {0}!",
  "stats_info":   "{0} | Kills: {1} Deaths: {2}",
  "kicked_msg":   "You have been kicked: {0}"
}
```

```json
// translations/tr.json
{
  "welcome_msg":  "Sunucuya hoş geldiniz, {0}!",
  "stats_info":   "{0} | Öldürme: {1} Ölüm: {2}",
  "kicked_msg":   "Kovuldunuz: {0}"
}
```

### Step 2: Load & Use

```typescript
public override async OnLoad(game: IGameBridge) {
  game.LoadTranslations("my-plugin");

  game.HookEvent("PlayerConnect", (data) => {
    const client = data.client as number;
    const name   = game.GetClientName(client);
    game.TPrintToChat(client, "welcome_msg", name);
  });
}
```

`TPrintToChat` auto-detects the player's language preference.

---

## Async Tasks

Use `Task.Run()` for any I/O, HTTP, or database operations. It runs via `queueMicrotask` — zero timer delay, no tick blocking.

```typescript
import { BasePlugin, Task, type IGameBridge } from "meta-bun/core";

export default class DataPlugin extends BasePlugin {
  public override name    = "DataPlugin";
  public override version = "1.0.0";
  public override author  = "Dev";

  public override async OnLoad(game: IGameBridge) {
    game.RegConsoleCmd("sm_fetch", (client, args) => {
      // Never use await directly in a sync callback!
      // Use Task.Run for deferred async work
      Task.Run(async () => {
        const res  = await fetch("https://api.example.com/news");
        const json = await res.json() as { headline: string };
        game.PrintToChat(client, `{Gold}News: ${json.headline}`);
      });
    }, "Fetch latest news");
  }
}
```

### Rules

| ✅ Do | ❌ Don't |
|-------|---------|
| `Task.Run(async () => { ... })` | `Task.Run(() => { sync code })` |
| Use `await` inside `Task.Run` | Use `await` in command callbacks directly |
| Let errors propagate to catch | Swallow errors silently |

---

## Timers

```typescript
// One-shot timer (fires once after delay)
const timer = game.CreateTimer(10000, () => {
  game.PrintToChatAll("{Yellow}10 seconds have passed!");
});

// Repeating timer (every 60 seconds)
const repeating = game.CreateTimer(60000, () => {
  game.PrintToChatAll("{Gold}Remember to visit our website!");
}, true);

// Cancel it
game.KillTimer(repeating);
```

> Timers registered in a plugin context are **automatically cleaned up** on plugin unload.

---

## GeoIP & IP Lookup

```typescript
game.HookEvent("PlayerConnect", (data) => {
  const client  = data.client as number;
  const name    = game.GetClientName(client);
  const ip      = game.GetClientIP(client);
  const country = game.GetClientCountry(client);

  game.PrintToChatAll(`{Gold}${name} connected from ${country}`);
  game.LogMessage(`${name} IP=${ip} Country=${country}`);
});
```

Configure IP ranges in `configs/geoip.json`. The file is auto-created with defaults if missing.

---

## State Retention Across Hot-Reloads

When a plugin file is saved and hot-reloaded, its JavaScript module is re-imported. Any in-memory variables are lost. Use `GetState` / `SetState` to persist data:

```typescript
export default class CounterPlugin extends BasePlugin {
  public override name = "CounterPlugin";
  public override version = "1.0.0";
  public override author = "Dev";

  public override async OnLoad(game: IGameBridge) {
    // Restore counter from before the reload (or default to 0)
    let count = game.GetState("hitCount", 0);

    game.RegConsoleCmd("sm_hit", (client, args) => {
      count++;
      game.SetState("hitCount", count);  // persist across reloads
      game.PrintToChatAll(`Hit count: ${count}`);
    }, "Increment hit counter");
  }
}
```

---

## File Logging

```typescript
game.LogToFile("my-plugin.log", `Player ${name} used command sm_test`);
// Output in logs/my-plugin.log:
// [2026-06-04T18:00:00.000Z] [MyPlugin] Player John used command sm_test
```

The `logs/` directory is created automatically if it does not exist.

---

## Mute / Gag / Silence

```typescript
const player = game.players.Get(client);
if (!player) return;

player.Mute();     // Block voice
player.Unmute();

player.Gag();      // Block text chat
player.Ungag();

player.Silence();  // Mute + Gag
player.Unsilence();

// Check state
if (player.IsMuted())  { /* ... */ }
if (player.IsGagged()) { /* ... */ }
```

Mute/gag state is **persisted to the database** and restored on reconnect.

Chat messages from gagged players are automatically blocked by the `PluginManager`'s command interceptor.

---

## AFK Detection

The `PlayerManager` includes an AFK scan utility:

```typescript
// Move idle players (idle > 120 seconds) to spectator
game.players.CheckAFKPlayers(120, "spec");

// Kick idle players
game.players.CheckAFKPlayers(300, "kick");
```

Use with a repeating timer to run this periodically:

```typescript
game.CreateTimer(60000, () => {
  (game.players as any).CheckAFKPlayers(180, "spec");
}, true);
```

Player activity is tracked on: movement, chat, weapon use, headshots, damage.

---

## Hot-Reload Behavior

When a plugin file is saved:

1. `OnUnload()` is called on the old instance
2. `PluginContext.Cleanup()` runs:
   - Removes all registered event listeners
   - Kills all timers created in that context
   - Unregisters all console commands
3. The new file is imported (cache-busted with timestamp)
4. A fresh `PluginContext` is created
5. `OnLoad()` is called on the new instance

**Preserved across reloads:**
- State stored via `game.SetState()` / `game.GetState()`
- Database contents (SQLite is external)

**Lost across reloads:**
- Local variables in `OnLoad()` scope
- In-memory data structures
- Any timers, listeners, or commands (re-registered by new `OnLoad`)

---

## Best Practices

### ✅ Do

```typescript
// Use typed access on player data
const player = game.players.Get(client);
if (!player) return; // always null-check

// Use Task.Run for I/O
Task.Run(async () => {
  await someDatabase.query(/* ... */);
});

// Use SetState to persist across hot-reloads
game.SetState("myData", value);

// Use LogToFile for persistent audit trails
game.LogToFile("audit.log", `Ban: ${steamId} by ${adminId}`);
```

### ❌ Don't

```typescript
// Don't use await in sync callbacks
game.RegConsoleCmd("sm_cmd", async (client, args) => {
  await something(); // ❌ may block or behave unexpectedly
});

// Don't use synchronous functions in Task.Run
Task.Run(() => {
  doSomethingSync(); // ❌ throws TypeError at runtime
});

// Don't use global variables for cross-reload state
let counter = 0; // ❌ reset on every hot-reload
// ✅ Use: game.GetState("counter", 0)
```

### Code Style

- Follow PascalCase for all public methods and class names
- Always provide a `description` parameter to `RegConsoleCmd`
- Always call `game.LogMessage()` in `OnLoad()` to confirm successful initialization
- Handle the case where `game.players.Get(client)` returns `undefined`
- Test permission checks with `CheckCommandAccess` before destructive operations
