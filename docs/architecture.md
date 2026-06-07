# MetaBun — Architecture & System Design

> Technical deep-dive into MetaBun's internal architecture, component interactions, and design decisions.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [IPC Bridge Design](#ipc-bridge-design)
3. [128 Tickrate Loop](#128-tickrate-loop)
4. [Plugin Loading & Hot-Reload](#plugin-loading--hot-reload)
5. [Plugin Context Isolation](#plugin-context-isolation)
6. [Event Distribution](#event-distribution)
7. [Command Interception](#command-interception)
8. [Non-Blocking Task System](#non-blocking-task-system)
9. [Player Session Lifecycle](#player-session-lifecycle)
10. [Database Architecture](#database-architecture)
11. [Admin & Permission System](#admin--permission-system)
12. [GeoIP Lookup System](#geoip-lookup-system)
13. [Translation System](#translation-system)

---

## System Overview

MetaBun is a **two-process architecture**:

```
┌──────────────────────────────────────────────────────────────┐
│  Game Server Process (Linux/Windows)                         │
│                                                              │
│  ┌─────────────────────┐     fork/exec                      │
│  │  Metamod C++ Plugin │ ──────────────► Bun Process        │
│  │                     │                                     │
│  │  • GameFrame hooks  │◄─── TCP Socket ─────────────────┐  │
│  │  • PlayerChat hooks │     (127.0.0.1:8080)            │  │
│  │  • Event hooks      │                                  │  │
│  │  • Execute commands │                                  │  │
│  └─────────────────────┘                                  │  │
│                                         ┌──────────────────┘ │
│                                         │  MetaBunApp         │
│                                         │  ├ PluginManager    │
│                                         │  ├ PlayerManager    │
│                                         │  ├ AdminManager     │
│                                         │  ├ BanManager       │
│                                         │  ├ DatabaseManager  │
│                                         │  └ Plugins (TS)     │
└──────────────────────────────────────────────────────────────┘
```

**Why separate processes?**

- **Crash Isolation:** A crashing TypeScript plugin cannot crash the game server
- **Hot-Reload:** Bun process can reload plugin files without touching the game
- **TypeScript Native:** Bun runs TS directly — no build step needed
- **NPM Ecosystem:** Plugins can `import` any npm package

---

## IPC Bridge Design

### Protocol Stack

The bridge uses a simple framed protocol over a local TCP connection:

```
C++ Metamod                    Bun MetaBunApp
    │                               │
    │──── GameEvent (JSON/MsgPack) ─►│
    │                               │
    │◄─── GameAction (JSON/MsgPack) ─│
    │                               │
```

### Supported Protocols

| Name | Format | Description |
|------|--------|-------------|
| `ndjson` | `{...}\n` | Newline-delimited JSON — easiest to debug |
| `length_prefixed_json` | `[4-byte BE len][JSON bytes]` | Reliable framing for JSON |
| `length_prefixed_msgpack` | `[4-byte BE len][MsgPack bytes]` | Binary — lowest overhead |

Selected via `BRIDGE_PROTOCOL` environment variable.

### Framing Logic

```
Incoming Buffer (TCP):
┌────────────────────────────────────┐
│ 00 00 00 2F │ { "event": "..." }   │
│  (length=47) │   (47 bytes JSON)   │
└────────────────────────────────────┘

Buffer accumulation → parse when length bytes available → dispatch
```

The `MetaBunApp` uses a per-socket `Buffer` to handle partial TCP frames correctly. The framing loop re-processes the buffer until no complete messages remain.

---

## 128 Tickrate Loop

### Implementation

```typescript
// Drift-corrected tick scheduling
private TickLoop(): void {
  if (!this.isTickLoopRunning) return;

  this.currentTick++;
  this.engineTime = this.currentTick / 128;  // simulated engine time

  // Emit GameFrame at every tick
  this.pluginManager.emit("GameFrame", {
    event: "GameFrame",
    tick: this.currentTick,
    time: this.engineTime
  });

  // Drift correction: schedule next tick based on wall-clock target
  const now = performance.now();
  this.nextTickTime += this.tickIntervalMs;  // 7.8125ms
  const delay = Math.max(0, this.nextTickTime - now);
  this.tickTimeout = setTimeout(() => this.TickLoop(), delay);
}
```

### Drift Correction

Without correction, `setTimeout(fn, 7.8125)` accumulates timing error because:
- `setTimeout` has ~1ms minimum resolution
- Each call introduces small scheduling jitter

With correction, the **next target time** advances by exactly `tickIntervalMs` from the scheduled base, not from the actual fire time. This prevents drift accumulation over time.

### Engine Time

`GetEngineTime()` returns the **simulated** engine time driven by the tick counter, not `process.uptime()`. This ensures plugins receive a game-tick-synchronized clock.

```typescript
engineTime = currentTick / 128
// At tick 128 → engineTime = 1.0 (1 simulated second)
// At tick 256 → engineTime = 2.0 (2 simulated seconds)
```

---

## Plugin Loading & Hot-Reload

### Load Sequence

```
LoadPlugin("admin-tools.ts")
    │
    ├─ existsSync check
    ├─ If already loaded → UnloadPlugin() first
    │
    ├─ import("plugins/admin-tools.ts?update=<timestamp>")
    │         └─ Cache-busting via query string parameter
    │
    ├─ Detect plugin type:
    │   ├─ Class with default export → new PluginClass()
    │   ├─ Object default export → use directly
    │   └─ No default export → functional SourceMod-style wrapper
    │
    ├─ new PluginContext(name, manager, bridge, players, admins, cmdRegistry)
    │
    └─ pluginContextStore.run(context, () => plugin.OnLoad(context))
```

### Cache Busting

Bun (like Node.js) caches imported modules. To force reimport on hot-reload, a unique `?update=<timestamp>` query string is appended to the import path. This creates a new cache entry, bypassing the old module.

### File Watcher

```typescript
fs.watch(pluginsFolder, (event, filename) => {
  if (filename?.endsWith(".ts") || filename?.endsWith(".js")) {
    setTimeout(() => this.LoadPlugin(filename), 100); // 100ms debounce
  }
});
```

The 100ms delay prevents partial-read issues when editors write files in multiple operations.

---

## Plugin Context Isolation

Each plugin gets its own `PluginContext` instance — a scoped implementation of `IGameBridge` that:

1. **Tracks resources:** All event listeners, timers, and commands are recorded
2. **Cleans up on unload:** `Cleanup()` removes all listeners, kills all timers, unregisters all commands
3. **Wraps callbacks:** All callbacks run inside `pluginContextStore.run(context, cb)` so native functions know which plugin called them

```typescript
// Native function called from any plugin code:
export function PrintToChat(client, message) {
  getContext().PrintToChat(client, message); // getContext() → current plugin's context
}
```

### AsyncLocalStorage

`pluginContextStore` is a `AsyncLocalStorage<PluginContext>`. This propagates the active context through the async call stack, including through `await`, `Promise`, and `EventEmitter` callbacks — all without passing the context explicitly.

```
pluginContextStore.run(pluginContext, () => {
  plugin.OnLoad(context);
  // All async operations spawned here inherit the context
  // getContext() returns pluginContext anywhere in this chain
});
```

---

## Event Distribution

### Flow

```
C++ Metamod fires hook
        │
        ▼
MetaBunApp.HandlePayload(GameEvent)
        │
        ├── Player management updates (connect/disconnect/stats)
        │
        └── pluginManager.emit(event, data)
                │
                ▼
         EventEmitter.emit()
                │
                ├── Plugin A listener (wrapped in pluginContextStore.run)
                ├── Plugin B listener (wrapped in pluginContextStore.run)
                └── Plugin C listener (wrapped in pluginContextStore.run)
```

### Dynamic Hook Management

When a plugin registers for an event, the `PluginManager` automatically notifies C++ via `hook_event`:

```typescript
this.on("newListener", (event) => {
  if (this.listenerCount(event) === 0) {
    this.bridge.Send({ action: "hook_event", event }); // tell C++ to start sending this event
  }
});

this.on("removeListener", (event) => {
  setTimeout(() => {
    if (this.listenerCount(event) === 0) {
      this.bridge.Send({ action: "unhook_event", event }); // no more listeners → stop sending
    }
  }, 0);
});
```

This ensures C++ only forwards events that have active listeners — minimizing unnecessary network traffic.

---

## Command Interception

Chat messages starting with `!` or `/` are intercepted by the `PluginManager` and resolved to registered commands.

### Resolution Order

```
Player types "!slap 3 10"
        │
        ▼
PlayerChat event fires
        │
        ▼
text = "!slap 3 10"
commandName = "slap"
args = ["3", "10"]

Lookup order:
  1. commands.get("sm_slap")    ← primary SourceMod-style
  2. commands.get("slap")       ← fallback exact name
  3. commands.get("!slap")      ← fallback with trigger symbol
```

### Gag Check

Gagged players' chat messages are blocked before command resolution:

```typescript
if (player?.IsGagged()) {
  player.Say("Your chat is blocked.");
  return; // command NOT executed
}
```

---

## Non-Blocking Task System

### Why Async Operations Are Dangerous

The game tick loop runs every 7.8125ms (128 Hz). If any synchronous operation takes longer, tick timing drifts. TypeScript can't truly block the event loop on async ops, but poorly structured code can delay microtask processing.

### `Task.Run` Design

```typescript
public static Run(action: () => Promise<any>): void {
  queueMicrotask(() => {
    const result = action();
    if (!result?.then) throw new TypeError("Must be async");
    result.catch((err) => console.error("[Task.Run]", err));
  });
}
```

### Execution Model

```
Current tick frame:
  ┌─────────────────────────┐
  │ 1. TickLoop() runs      │
  │ 2. emit("GameFrame")    │
  │ 3. Plugin listeners run │
  │    └─ Task.Run(fn)      │ ← schedules via queueMicrotask
  │ 4. setTimeout scheduled │ ← next tick scheduled
  └─────────────────────────┘

After current call stack resolves:
  ┌─────────────────────────┐
  │ Microtask checkpoint    │
  │ └─ fn() runs (async)   │ ← async, non-blocking
  └─────────────────────────┘

Next event loop macrotask:
  ┌─────────────────────────┐
  │ Next tick fires         │
  └─────────────────────────┘
```

`queueMicrotask` vs `setTimeout(fn, 0)`:
- `setTimeout(fn, 0)` → executes in the **next macrotask** (after ~1–4ms minimum)
- `queueMicrotask(fn)` → executes in the **current microtask checkpoint** (0ms)

---

## Player Session Lifecycle

```
PlayerConnect event received
        │
        ▼
new Player(bridge, adminManager, banManager, index, name, steamId, userId)
        │
        ▼
PlayerManager.AddPlayer(player)
  ├─ DatabaseManager.GetPlayer(steamId)
  ├─ Restore: kills, deaths, assists, headshots, damage, mvps, playtime
  ├─ Restore: is_muted, is_gagged
  └─ players.set(index, player)
        │
        ▼
pluginManager.emit("OnClientPostAdminCheck", { client, player })
  └─ Plugin callbacks fire

[In-game]
  • PlayerStatsUpdate events → player.UpdateHealth/Armor/Money/Team/Location
  • PlayerDeath → player.emit("Death"), _isAlive = false
  • TeamChange → player.emit("TeamChange")

PlayerDisconnect event received
        │
        ▼
PlayerManager.RemovePlayer(index)
  ├─ DatabaseManager.UpsertPlayer(stats)  ← save all accumulated stats
  └─ players.delete(index)
```

### Checkpointing

If `enableCheckpointing = true`, stats are auto-saved every 5 minutes via `setInterval(() => this.Checkpoint(), 5 * 60 * 1000)`. This prevents data loss if the server crashes between player disconnect saves.

---

## Database Architecture

MetaBun uses **Bun's native SQLite** (`bun:sqlite`) for zero-dependency embedded persistence.

### Schema Migrations

The `Initialize()` method creates tables with `IF NOT EXISTS` and then runs `ALTER TABLE ADD COLUMN` migrations for each new column — catching errors silently for columns that already exist. This pattern allows safe schema evolution without breaking existing databases.

```typescript
try { db.run("ALTER TABLE players ADD COLUMN total_headshots INTEGER DEFAULT 0"); } catch (_) {}
```

### UpsertPlayer Accumulation

Stats are **accumulated** (not replaced) on upsert:

```sql
ON CONFLICT(steamid) DO UPDATE SET
  total_kills = total_kills + excluded.total_kills,
  total_deaths = total_deaths + excluded.total_deaths,
  ...
  is_muted = excluded.is_muted  -- replaced, not accumulated
```

This means calling `UpsertPlayer` multiple times correctly adds up stats while keeping the latest mute/gag state.

---

## Admin & Permission System

### Config Parsing

On `AdminManager` initialization, `configs/admins.json` is parsed. Both shorthand string format and object format are supported:

```json
{
  "STEAM_0:1:123": "z",                        // shorthand → flags = "z", immunity = 99
  "STEAM_0:0:456": { "flags": "cd", "immunity": 50 }  // explicit
}
```

### Root Access (`z` flag)

`HasPermission(steamId, flag)` always returns `true` if the admin has the `z` flag, regardless of what `flag` is checked. This implements the superadmin pattern.

### Immunity

`CanTarget(adminId, targetId)` compares immunity levels:

```typescript
return adminManager.GetImmunity(adminId) >= adminManager.GetImmunity(targetId);
```

Admins can only target players with equal or lower immunity. This prevents lower-ranked admins from acting against higher-ranked ones.

---

## GeoIP Lookup System

### Data Structure

IP ranges are stored as sorted `GeoIpRange[]` in memory:

```typescript
{ start: 16843008, end: 16844799, country: "Turkey" }
// 1.1.0.0 → 1.1.255.255
```

All IPs are converted to 32-bit unsigned integers for fast comparison.

### Binary Search

`Lookup()` uses a classic binary search — O(log n) — on the sorted array:

```typescript
while (low <= high) {
  const mid = (low + high) >> 1;
  if (ipLong >= range.start && ipLong <= range.end) return range.country;
  if (ipLong < range.start) high = mid - 1;
  else low = mid + 1;
}
```

This is orders of magnitude faster than linear scan for large databases.

---

## Translation System

### Storage Structure

```
Map<pluginName, Map<lang, Map<key, value>>>

TranslationManager.translations
├── "AdminTools"
│   ├── "en" → { "stats_info" → "Player: {0} | Kills: {1}" }
│   └── "tr" → { "stats_info" → "{0} | Öldürme: {1}" }
└── "MyPlugin"
    └── "en" → { "welcome" → "Welcome {0}!" }
```

### Fallback Chain

1. Try the player's language (`GetLanguage()`)
2. If not found → fall back to `"en"`
3. If `"en"` not found → return the raw key string

This ensures plugins always display something meaningful even without full translation coverage.

### Template Formatting

Uses `{N}` positional placeholders:

```typescript
Format("Player: {0} | K:{1} D:{2}", "John", 15, 3)
// → "Player: John | K:15 D:3"
```
