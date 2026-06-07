# MetaBun — Complete API Reference

> Full technical reference for all public interfaces, classes, types, and methods in the MetaBun framework.

---

## Table of Contents

1. [IGameBridge](#igamebridge)
2. [BasePlugin](#baseplugin)
3. [Task](#task)
4. [Player](#player)
5. [PlayerManager](#playermanager)
6. [AdminManager](#adminmanager)
7. [BanManager](#banmanager)
8. [DatabaseManager](#databasemanager)
9. [TranslationManager](#translationmanager)
10. [GeoIPService](#geoipservice)
11. [Bridge](#bridge)
12. [Menu / IMenu](#menu--imenu)
13. [Enums & Types](#enums--types)
14. [Game Events](#game-events)
15. [Native Functions](#native-functions)

---

## IGameBridge

**File:** `src/ts/shared/types/bridge.ts`  
**Implemented by:** `PluginManager`, `PluginContext`

The core API interface passed to every plugin's `OnLoad()`. Provides full access to all game engine features.

---

### Core Methods

#### `HookEvent(event, callback)`
Registers a listener for a named game event.

```typescript
game.HookEvent("PlayerDeath", (data) => {
  game.PrintToChatAll(`Player ${data.client} was eliminated!`);
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `string` | Event name (e.g. `"PlayerChat"`, `"RoundEnd"`) |
| `callback` | `(data: GameEvent) => void` | Handler triggered on event fire |

---

#### `ServerCommand(cmd)`
Executes a command in the server engine console.

```typescript
game.ServerCommand("mp_restartgame 1");
```

---

#### `RegConsoleCmd(command, callback, description?)`
Registers a command triggerable by `!command` or `/command` in chat, or via console.

```typescript
game.RegConsoleCmd("sm_slap", (client, args) => {
  const target = parseInt(args[0] ?? "0");
  const dmg = parseInt(args[1] ?? "0");
  game.SlapPlayer(target, dmg);
}, "Slap a player");
```

> The `sm_` prefix means `!slap` triggers `sm_slap`.

---

#### `LogMessage(message)`
Logs a message prefixed with the plugin name.

```typescript
game.LogMessage("Plugin loaded"); // [MyPlugin] Plugin loaded
```

---

#### `CreateTimer(ms, callback, repeat?)`

```typescript
const t = game.CreateTimer(5000, () => game.PrintToChatAll("5 seconds!"));
const rt = game.CreateTimer(1000, () => game.PrintToChatAll("Tick!"), true);
game.KillTimer(rt);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `ms` | `number` | Delay/interval in milliseconds |
| `callback` | `() => void` | Callback to run |
| `repeat` | `boolean?` | Repeat periodically |

Returns: `Timer` handle for `KillTimer()`.

---

#### `KillTimer(timer)`
Terminates an active timer.

---

#### `CreateMenu(title, callback)`
Creates an interactive client menu.

```typescript
const menu = game.CreateMenu("Choose", (client, info) => {
  if (info === "respawn") game.RespawnPlayer(client);
});
menu.AddItem("respawn", "Respawn Me");
menu.Display(client);
```

---

### Messaging

| Method | Description |
|--------|-------------|
| `PrintToChat(client, msg)` | Send colored message to one client (client=0 → all) |
| `PrintToChatAll(msg)` | Broadcast to all clients |
| `ReplyToCommand(client, msg)` | Chat reply for players; console for server (client 0) |
| `TPrintToChat(client, key, ...args)` | Send localized translated message |
| `LoadTranslations(filename)` | Load translation JSON files for the plugin |

Color tags supported: `{Green}`, `{Red}`, `{Yellow}`, `{Gold}`, `{Blue}`, `{Cyan}`, `{Purple}`, `{Grey}`, `{Default}`, etc.

---

### Client Info

| Method | Return | Description |
|--------|--------|-------------|
| `GetMaxClients()` | `number` | Maximum server capacity |
| `GetClientCount(inGameOnly?)` | `number` | Connected client count |
| `GetClientName(client)` | `string` | Display name |
| `GetClientAuthId(client)` | `string` | SteamID |
| `GetClientUserId(client)` | `number` | Engine UserID |
| `GetClientHealth(client)` | `number` | Current HP |
| `GetClientMoney(client)` | `number` | In-game money |
| `GetClientTeam(client)` | `number` | Team index |
| `IsClientInGame(client)` | `boolean` | Fully connected? |
| `IsPlayerAlive(client)` | `boolean` | Alive? |
| `GetClientIP(client)` | `string` | IP address |
| `GetClientCountry(client)` | `string` | Country via GeoIP |

---

### Actions

| Method | Description |
|--------|-------------|
| `SlapPlayer(client, damage)` | Slap with damage |
| `TeleportEntity(client, x, y, z)` | Move to 3D position |
| `ChangeClientTeam(client, team)` | Switch team |
| `RespawnPlayer(client)` | Force respawn |
| `KickClient(client, reason?)` | Kick from server |
| `BanClient(steamId, reason, adminSteamId, duration)` | Ban by SteamID |
| `RemoveBan(steamId)` | Remove ban |

---

### Weapons & Inventory

| Method | Description |
|--------|-------------|
| `GivePlayerItem(client, item)` | Give weapon (e.g. `"weapon_ak47"`) |
| `RemovePlayerItem(client, item)` | Remove weapon |
| `GetClientWeapon(client)` | Active weapon name |
| `SetWeaponAmmo(client, weapon, ammo)` | Set weapon ammo |

---

### Entity Properties

| Method | Description |
|--------|-------------|
| `SetEntityGravity(client, gravity)` | Gravity multiplier (default: 1.0) |
| `SetEntityMoveType(client, movetype)` | Movement type ID |
| `SetEntityHealth(client, health)` | Set HP directly |
| `SetEntityModel(client, model)` | Change player model |
| `SetEntityRenderColor(client, r, g, b, a)` | RGBA render color |
| `EmitSoundToClient(client, soundPath)` | Play sound to one player |
| `EmitSoundToAll(soundPath)` | Play sound to all |

---

### Permissions

#### `CheckCommandAccess(client, command, flags)`
Returns `true` if the client has the required flags.

```typescript
if (game.CheckCommandAccess(client, "sm_ban", "d")) {
  game.BanClient(targetSteamId, "Cheating", adminSteamId, 60);
}
```

| Flag | Description |
|------|-------------|
| `a` | VIP / reserved slot |
| `c` | Basic admin (slap, kick, menu) |
| `d` | Ban management |
| `z` | Root — all permissions |

#### `GetUserFlagBits(client)`
Returns full flag string (e.g. `"acd"`).

---

### Voting

#### `CreateVote(question, options, callback, durationMs?)`

```typescript
game.CreateVote("Restart round?", ["Yes", "No"], (results) => {
  if (results["Yes"] > results["No"]) game.ServerCommand("mp_restartgame 1");
}, 15000);
```

---

### Engine Metrics

| Method | Returns | Description |
|--------|---------|-------------|
| `GetEngineTime()` | `number` | Simulated uptime in seconds |
| `GetTickrate()` | `number` | Always `128` |
| `GetTickInterval()` | `number` | `1/128` ≈ `0.007813` seconds |
| `GetBridgeLatency()` | `number` | Bun ↔ C++ latency estimate |

---

### File Logging

#### `LogToFile(filename, message)`
Appends to a file in the `logs/` directory.

```typescript
game.LogToFile("my-plugin.log", "Player joined: " + name);
// [2026-06-04T18:00:00Z] [MyPlugin] Player joined: John
```

---

### State Retention

```typescript
game.SetState("counter", 42);            // Save across hot-reload
const c = game.GetState("counter", 0);  // Restore (default: 0)
```

---

## BasePlugin

**File:** `src/ts/shared/plugin.ts`

All plugins must extend this class.

```typescript
export default class MyPlugin extends BasePlugin {
  public override name    = "MyPlugin";
  public override version = "1.0.0";
  public override author  = "Dev";

  public override async OnLoad(game: IGameBridge) { /* ... */ }
  public override async OnUnload() { /* cleanup */ }
}
```

| Member | Type | Description |
|--------|------|-------------|
| `name` | `string` | Unique plugin name |
| `version` | `string` | Version string |
| `author` | `string` | Author |
| `OnLoad(game)` | method | Called on load — register hooks/commands |
| `OnUnload()` | method (optional) | Called on unload/hot-reload |

---

## Task

**File:** `src/ts/shared/task.ts`

Zero-delay async executor. Uses `queueMicrotask` — no timer-wheel overhead.

### `Task.Run(action)`

```typescript
Task.Run(async () => {
  const response = await fetch("https://api.example.com/data");
  const json = await response.json();
  game.LogMessage("Fetched: " + JSON.stringify(json));
});
```

**Rules:**
- `action` **must** return a `Promise` (be `async`)
- Synchronous functions throw `TypeError` at runtime
- Promise rejections are caught and logged; never crash the server

**Why `queueMicrotask` vs `setTimeout`?**

| Method | Delay |
|--------|-------|
| `setTimeout(fn, 0)` | ~1–4ms |
| `queueMicrotask(fn)` | 0ms |

Runs after the current call stack resolves, before the next macrotask — preventing any tick-frame delay.

---

## Player

**File:** `src/ts/players/player.ts`  
**Extends:** `EventEmitter`

Represents an active player session with full state and engine command dispatch.

### Readonly Properties

| Property | Type | Description |
|----------|------|-------------|
| `index` | `number` | Client slot (1-based) |
| `name` | `string` | Display name |
| `steamId` | `string` | SteamID |
| `userId` | `number` | Engine UserID |

### Stats

| Method | Description |
|--------|-------------|
| `GetHealth()` | HP |
| `GetArmor()` | Armor |
| `GetMoney()` | Money |
| `GetTeam()` | `Team` enum |
| `GetKills()` | Session kills |
| `GetDeaths()` | Session deaths |
| `GetAssists()` | Session assists |
| `GetTotalKills()` | Persistent kills |
| `GetTotalDeaths()` | Persistent deaths |
| `GetTotalAssists()` | Persistent assists |
| `GetHeadshots()` | Headshot kills |
| `GetDamage()` | Total damage dealt |
| `GetMVPs()` | MVP count |
| `GetPlaytime()` | Total playtime (seconds) |
| `GetIdleTime()` | Seconds since last activity |
| `GetLocation()` | `{ x, y, z }` world position |
| `GetAngles()` | `{ x, y, z }` view angles |
| `GetIPAddress()` | IP address string |
| `GetCountry()` | Country from GeoIP |
| `GetLanguage()` | Language code |
| `GetImmunity()` | Admin immunity level |
| `GetWeapon()` | Active weapon |
| `GetInventory()` | `Map<string, Weapon>` |

### Checks

| Method | Returns | Description |
|--------|---------|-------------|
| `IsAlive()` | `boolean` | Alive? |
| `IsBot()` | `boolean` | Bot? |
| `IsMuted()` | `boolean` | Voice muted? |
| `IsGagged()` | `boolean` | Chat gagged? |
| `IsBanned()` | `Promise<boolean>` | Banned (async check)? |
| `HasFlag(flag)` | `boolean` | Has admin flag? |
| `CanTarget(player)` | `boolean` | Immunity allows targeting? |
| `HasWeapon(name)` | `boolean` | Has weapon in inventory? |

### Actions

| Method | Description |
|--------|-------------|
| `Say(message)` | Private message to this player |
| `Kick(reason?)` | Kick |
| `Slap(damage)` | Slap with damage |
| `Teleport(x, y, z)` | Move to coordinates |
| `Respawn()` | Force respawn |
| `SetTeam(team)` | Change team |
| `SetHealth(hp)` | Set health |
| `SetGravity(g)` | Set gravity scale |
| `SetMoveType(mt)` | Set movement type |
| `SetModel(model)` | Change model |
| `SetRenderColor(r,g,b,a)` | Set RGBA color |
| `EmitSound(path)` | Play sound to this player |
| `Mute() / Unmute()` | Voice mute toggle |
| `Gag() / Ungag()` | Chat gag toggle |
| `Silence() / Unsilence()` | Mute + Gag simultaneously |
| `GiveWeapon(name, attrs?)` | Add to inventory |
| `RemoveWeapon(name)` | Remove from inventory |

### EventEmitter Events

| Event | Data | Fired When |
|-------|------|------------|
| `HealthChange` | `number` | Health updated |
| `TeamChange` | `Team` | Team changed |
| `Death` | — | Player dies |
| `WeaponChange` | `string` | Weapon updated |
| `MuteChange` | `boolean` | Mute toggled |
| `GagChange` | `boolean` | Gag toggled |

---

## PlayerManager

**File:** `src/ts/players/manager.ts`

Manages the player session collection and handles DB persistence.

### Constructor

```typescript
new PlayerManager(db?, enableCheckpointing?)
// enableCheckpointing = true → auto-saves every 5 minutes
```

### Methods

| Method | Description |
|--------|-------------|
| `AddPlayer(player)` | Register; restores stats from DB |
| `RemovePlayer(index)` | Save stats; remove session |
| `Get(index)` | By client index |
| `FindByName(name)` | By display name |
| `FindBySteamId(steamId)` | By SteamID |
| `GetAll()` | All sessions |
| `GetClientsByTeam(team)` | By team |
| `GetAliveClients()` | Alive players |
| `GetInGameClients()` | In-game players |
| `Checkpoint()` | Manual stat flush to DB |
| `CheckAFKPlayers(maxIdle, action?)` | Move/kick idle players (`"spec"` or `"kick"`) |
| `CheckReservation(steamId, flags, maxClients?)` | VIP slot reservation |

---

## AdminManager

**File:** `src/ts/admins/manager.ts`

Loads `configs/admins.json` and provides flag + immunity management.

### Config Format

```json
{
  "STEAM_0:1:12345678": "z",
  "STEAM_0:0:87654321": { "flags": "abc", "immunity": 50 }
}
```

### Methods

| Method | Description |
|--------|-------------|
| `HasPermission(steamId, flag)` | Has flag (or has `z`)? |
| `GetFlags(steamId)` | All flags string |
| `GetImmunity(steamId)` | Immunity level (0–99) |
| `SetImmunity(steamId, level)` | Update immunity |
| `SetFlags(steamId, flags)` | Assign flags dynamically |
| `CanTarget(adminId, targetId)` | Admin immunity ≥ target? |

---

## BanManager

**File:** `src/ts/admins/bans.ts`

Persistent ban storage with expiry checking.

| Method | Description |
|--------|-------------|
| `CheckBan(steamId)` | `Promise<boolean>` — banned and not expired? |
| `BanClient(steamId, reason, adminId, duration)` | Add ban (duration in minutes; 0 = permanent) |
| `RemoveBan(steamId)` | Remove ban |

---

## DatabaseManager

**File:** `src/ts/shared/database.ts`

Bun-native SQLite wrapper. Auto-creates schema and handles migrations.

### Schema

**`players`**

| Column | Type | Description |
|--------|------|-------------|
| `steamid` | TEXT PK | SteamID |
| `last_name` | TEXT | Last seen name |
| `total_kills` | INTEGER | Accumulated kills |
| `total_deaths` | INTEGER | Accumulated deaths |
| `total_assists` | INTEGER | Accumulated assists |
| `total_headshots` | INTEGER | Headshot kills |
| `total_damage` | INTEGER | Damage dealt |
| `total_mvps` | INTEGER | MVP count |
| `total_playtime` | INTEGER | Seconds online |
| `is_muted` | INTEGER | 1 = muted |
| `is_gagged` | INTEGER | 1 = gagged |

**`bans`**

| Column | Type | Description |
|--------|------|-------------|
| `steamid` | TEXT PK | SteamID |
| `reason` | TEXT | Reason |
| `admin_steamid` | TEXT | Banning admin |
| `duration` | INTEGER | Minutes (0 = permanent) |
| `timestamp` | INTEGER | Unix ms timestamp |

### Methods

| Method | Description |
|--------|-------------|
| `UpsertPlayer(data)` | Insert or accumulate stats |
| `GetPlayer(steamId)` | Fetch player row |
| `AddBan(data)` | Insert/replace ban |
| `RemoveBan(steamId)` | Delete ban |
| `GetBan(steamId)` | Fetch ban row |

---

## TranslationManager

**File:** `src/ts/shared/translations.ts`

Loads JSON locale files from `translations/` and formats messages.

### Locale File Format

```json
// translations/en.json
{
  "welcome": "Welcome, {0}!",
  "stats_info": "Player: {0} | Kills: {1} | Deaths: {2}"
}
```

### Methods

| Method | Description |
|--------|-------------|
| `LoadTranslations(pluginName)` | Scan and load all `*.json` files |
| `GetTranslation(plugin, key, lang)` | Get string; falls back to `en` |
| `Format(text, ...args)` | Replace `{0}`, `{1}` … placeholders |

---

## GeoIPService

**File:** `src/ts/shared/geoip.ts`

IP-to-country lookup via sorted in-memory range database and binary search.

### Config: `configs/geoip.json`

```json
[
  { "start": "1.1.0.0", "end": "1.1.255.255", "country": "Turkey" },
  { "start": "8.8.8.0", "end": "8.8.8.255", "country": "United States" }
]
```

Auto-seeded with defaults if file is missing.

### Methods

| Method | Description |
|--------|-------------|
| `Lookup(ip)` | Country string or `"Local / Unknown"` |
| `IPToLong(ip)` | IPv4 string → 32-bit unsigned int |
| `LongToIP(long)` | 32-bit int → IPv4 string |

---

## Bridge

**File:** `src/ts/network/bridge.ts`

TCP socket writer — handles framing and serialization for the C++ side.

### Protocols

| Protocol | Framing |
|----------|---------|
| `ndjson` | JSON + `\n` |
| `length_prefixed_json` | 4-byte big-endian length + JSON bytes |
| `length_prefixed_msgpack` | 4-byte big-endian length + MsgPack bytes |

Set via `BRIDGE_PROTOCOL` env variable.

### Methods

| Method | Description |
|--------|-------------|
| `SetSocket(socket)` | Bind Bun TCP socket |
| `SetProtocol(protocol)` | Set encoding |
| `Send(action)` | Serialize and transmit `GameAction` |

### `GameAction` Shape

```typescript
{
  action: "command" | "say" | "menu" | "hook_event" | "unhook_event";
  cmd?: string;          // console command
  text?: string;         // chat message
  menu?: { title, items, id };
  client?: number;
  event?: string;
}
```

---

## Menu / IMenu

**File:** `src/ts/plugin-system/menu.ts`

```typescript
const menu = game.CreateMenu("Choose Option", (client, info) => {
  game.PrintToChat(client, `You chose: ${info}`);
});

menu.SetTitle("Updated Title");
menu.AddItem("opt_a", "Option A");
menu.AddItem("opt_b", "Option B");
menu.Display(client);
```

### IMenu Interface

| Method | Description |
|--------|-------------|
| `SetTitle(title)` | Update menu header |
| `AddItem(info, display)` | Add selectable option |
| `Display(client)` | Send to player |

---

## Enums & Types

### `Team` — `src/ts/shared/types/enums.ts`

```typescript
enum Team {
  Unassigned = 0,
  Spectator  = 1,
  Terrorist  = 2,
  CT         = 3
}
```

### `Action`

```typescript
enum Action {
  Continue = 0,   // Pass to next handler
  Changed  = 1,   // Modified, continue
  Handled  = 3,   // Block engine default
  Stop     = 4    // Stop all processing
}

// Aliases
Plugin_Continue, Plugin_Changed, Plugin_Handled, Plugin_Stop
```

### `BridgeProtocol`

```typescript
type BridgeProtocol = "ndjson" | "length_prefixed_json" | "length_prefixed_msgpack";
```

---

## Game Events

All events extend `GameEvent`:

```typescript
interface GameEvent {
  event: string;
  [key: string]: string | number | boolean | undefined;
}
```

### Event Reference

| Event | Key Fields | Description |
|-------|-----------|-------------|
| `PlayerChat` | `client`, `text` | Chat message sent |
| `PlayerConnect` | `client`, `name`, `steamid`, `userid`, `isBot` | Player joins |
| `PlayerDisconnect` | `client`, `reason` | Player leaves |
| `PlayerStatsUpdate` | `client`, `health`, `armor`, `money`, `team`, `isAlive`, `x/y/z`, `ax/ay/az` | Periodic update |
| `PlayerSpawn` | `client`, `team` | Player spawns |
| `PlayerDeath` | `client`, `attacker`, `assister?`, `headshot`, `weapon` | Kill event |
| `WeaponFire` | `client`, `weapon` | Shot fired |
| `BombPlanted` | `client`, `site` | Bomb planted |
| `RoundStart` | `timelimit`, `fraglimit` | Round begins |
| `RoundEnd` | `winner`, `reason` | Round over |
| `GameFrame` | `tick`, `time` | 128 ticks/second |
| `MenuSelect` | `client`, `menuId`, `info` | Menu item selected |
| `BridgeConnected` | — | C++ socket connected |
| `OnClientPostAdminCheck` | `client`, `player` | After connect + admin flags checked |

---

## Native Functions

Located in `src/ts/natives/` — module-scope wrappers around `PluginContext`.

> These functions **throw** if called outside an active plugin execution context.

### Import

```typescript
import {
  // Core
  LogMessage, PrintToChat, PrintToChatAll,
  ReplyToCommand, TPrintToChat, LoadTranslations,
  GetMaxClients, GetClientCount, BasePlugin, Task,

  // Player
  players, GetClientName, GetClientAuthId,
  GetClientHealth, SlapPlayer, KickClient, BanClient,
  RespawnPlayer, GivePlayerItem, SetEntityHealth,
  SetEntityGravity, EmitSoundToClient,

  // Console
  RegConsoleCmd, ServerCommand, CheckCommandAccess, GetUserFlagBits,

  // Events
  HookEvent,

  // Menus
  CreateMenu,

  // Timers
  CreateTimer, KillTimer,

  // Enums
  Team, Action, Plugin_Continue, Plugin_Handled, Plugin_Stop,
} from "meta-bun/core";
```
