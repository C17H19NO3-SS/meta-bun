// @bun
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = import.meta.require;

// src/ts/shared/types/enums.ts
var Team, Action, Plugin_Continue = 0 /* Continue */, Plugin_Changed = 1 /* Changed */, Plugin_Handled = 3 /* Handled */, Plugin_Stop = 4 /* Stop */, ReplySource, ReplySource_Console = 0 /* Console */, ReplySource_Chat = 1 /* Chat */;
var init_enums = __esm(() => {
  ((Team2) => {
    Team2[Team2["Unassigned"] = 0] = "Unassigned";
    Team2[Team2["Spectator"] = 1] = "Spectator";
    Team2[Team2["Terrorist"] = 2] = "Terrorist";
    Team2[Team2["CT"] = 3] = "CT";
  })(Team ||= {});
  ((Action2) => {
    Action2[Action2["Continue"] = 0] = "Continue";
    Action2[Action2["Changed"] = 1] = "Changed";
    Action2[Action2["Handled"] = 3] = "Handled";
    Action2[Action2["Stop"] = 4] = "Stop";
  })(Action ||= {});
  ((ReplySource2) => {
    ReplySource2[ReplySource2["Console"] = 0] = "Console";
    ReplySource2[ReplySource2["Chat"] = 1] = "Chat";
  })(ReplySource ||= {});
});

// src/ts/shared/context-store.ts
import { AsyncLocalStorage } from "async_hooks";
function GetContext() {
  const context = pluginContextStore.getStore();
  if (!context) {
    throw new Error("[MetaBun] Native function called outside of active plugin context!");
  }
  return context;
}
var pluginContextStore, commandSourceStore;
var init_context_store = __esm(() => {
  if (!globalThis.__metaBunContextStore) {
    globalThis.__metaBunContextStore = new AsyncLocalStorage;
  }
  pluginContextStore = globalThis.__metaBunContextStore;
  if (!globalThis.__metaBunCommandSourceStore) {
    globalThis.__metaBunCommandSourceStore = new AsyncLocalStorage;
  }
  commandSourceStore = globalThis.__metaBunCommandSourceStore;
});

// src/ts/shared/plugin.ts
class BasePlugin {
  name = null;
  version = null;
  author = null;
  constructor() {
    const originalOnLoad = this.OnLoad;
    this.OnLoad = async (game) => {
      const constructor = this.constructor;
      if (Array.isArray(constructor.__commands)) {
        for (const cmd of constructor.__commands) {
          game.RegConsoleCmd(cmd.name, (client, args) => {
            const method = this[cmd.methodName];
            if (typeof method === "function") {
              return method.call(this, client, args);
            }
          }, cmd.flags, cmd.description);
        }
      }
      if (Array.isArray(constructor.__eventHooks)) {
        for (const hook of constructor.__eventHooks) {
          game.HookEvent(hook.eventName, (data) => {
            const method = this[hook.methodName];
            if (typeof method === "function") {
              return method.call(this, data);
            }
          });
        }
      }
      if (originalOnLoad) {
        return originalOnLoad.call(this, game);
      }
    };
  }
}

// src/ts/shared/task.ts
class TaskRunner {
  static Run(action) {
    action().catch((error) => {
      console.error("[TaskRunner] Task failed with error:", error);
    });
  }
}

// src/ts/shared/decorators.ts
function Command(name, flags = null, description = null) {
  return function(target, propertyKey, descriptor) {
    const constructor = target.constructor;
    if (!constructor.__commands) {
      constructor.__commands = [];
    }
    constructor.__commands.push({ name, methodName: propertyKey, flags, description });
    return descriptor;
  };
}
function Hook(eventName) {
  return function(target, propertyKey, descriptor) {
    const constructor = target.constructor;
    if (!constructor.__eventHooks) {
      constructor.__eventHooks = [];
    }
    constructor.__eventHooks.push({ eventName, methodName: propertyKey });
    return descriptor;
  };
}

// src/ts/natives/console.ts
function RegConsoleCmd(command, callback, flags, description) {
  GetContext().RegConsoleCmd(command, callback, flags, description);
}
function ServerCommand(cmd) {
  GetContext().ServerCommand(cmd);
}
function CheckCommandAccess(client, command, flags) {
  return GetContext().CheckCommandAccess(client, command, flags);
}
function GetUserFlagBits(client) {
  return GetContext().GetUserFlagBits(client);
}
function PrintToConsole(client, message) {
  GetContext().PrintToConsole(client, message);
}
function GetCmdReplySource() {
  return GetContext().GetCmdReplySource();
}
var init_console = __esm(() => {
  init_context_store();
  init_enums();
  init_enums();
});

// src/ts/natives/player.ts
function GetClientName(client) {
  return GetContext().GetClientName(client);
}
function GetClientAuthId(client) {
  return GetContext().GetClientAuthId(client);
}
function GetClientUserId(client) {
  return GetContext().GetClientUserId(client);
}
function GetClientHealth(client) {
  return GetContext().GetClientHealth(client);
}
function GetClientMoney(client) {
  return GetContext().GetClientMoney(client);
}
function GetClientTeam(client) {
  return GetContext().GetClientTeam(client);
}
function IsClientInGame(client) {
  return GetContext().IsClientInGame(client);
}
function IsPlayerAlive(client) {
  return GetContext().IsPlayerAlive(client);
}
function SlapPlayer(client, damage) {
  GetContext().SlapPlayer(client, damage);
}
function TeleportEntity(client, x, y, z) {
  GetContext().TeleportEntity(client, x, y, z);
}
function ChangeClientTeam(client, team) {
  GetContext().ChangeClientTeam(client, team);
}
function RespawnPlayer(client) {
  GetContext().RespawnPlayer(client);
}
function KickClient(client, reason) {
  GetContext().KickClient(client, reason);
}
function BanClient(steamId, reason, adminSteamId, duration, ip = "") {
  GetContext().BanClient(steamId, reason, adminSteamId, duration, ip);
}
function RemoveBan(steamId) {
  GetContext().RemoveBan(steamId);
}
function GivePlayerItem(client, item) {
  GetContext().GivePlayerItem(client, item);
}
function RemovePlayerItem(client, item) {
  GetContext().RemovePlayerItem(client, item);
}
function GetClientWeapon(client) {
  return GetContext().GetClientWeapon(client);
}
function SetWeaponAmmo(client, weapon, ammo) {
  GetContext().SetWeaponAmmo(client, weapon, ammo);
}
function SetEntityGravity(client, gravity) {
  GetContext().SetEntityGravity(client, gravity);
}
function SetEntityMoveType(client, movetype) {
  GetContext().SetEntityMoveType(client, movetype);
}
function SetEntityHealth(client, health) {
  GetContext().SetEntityHealth(client, health);
}
function SetEntityModel(client, model) {
  GetContext().SetEntityModel(client, model);
}
function SetEntityRenderColor(client, r, g, b, a) {
  GetContext().SetEntityRenderColor(client, r, g, b, a);
}
function EmitSoundToClient(client, soundPath, volume = 1, channel = 0, pitch = 100) {
  GetContext().EmitSoundToClient(client, soundPath, volume, channel, pitch);
}
function EmitSoundToAll(soundPath, volume = 1, channel = 0, pitch = 100) {
  GetContext().EmitSoundToAll(soundPath, volume, channel, pitch);
}
function CanAdminTarget(admin, target) {
  if (admin === 0)
    return true;
  if (admin === target)
    return true;
  if (!GetContext().IsClientInGame(admin) || !GetContext().IsClientInGame(target)) {
    return false;
  }
  const adminSteamId = GetContext().GetClientAuthId(admin);
  const targetSteamId = GetContext().GetClientAuthId(target);
  return GetContext().adminManager.CanTarget(adminSteamId, targetSteamId);
}
function ProcessTargetString(adminClient, targetPattern) {
  const allInGame = players.GetInGameClients();
  const pattern = targetPattern.trim().toLowerCase();
  if (pattern === "@all" || pattern === "*") {
    return allInGame.map((p) => p.index);
  }
  if (pattern === "@ct") {
    return allInGame.filter((p) => p.GetTeam() === 3).map((p) => p.index);
  }
  if (pattern === "@t") {
    return allInGame.filter((p) => p.GetTeam() === 2).map((p) => p.index);
  }
  if (pattern === "@alive") {
    return allInGame.filter((p) => p.IsAlive()).map((p) => p.index);
  }
  if (pattern === "@dead") {
    return allInGame.filter((p) => !p.IsAlive()).map((p) => p.index);
  }
  if (pattern === "@me") {
    if (adminClient > 0 && GetContext().IsClientInGame(adminClient)) {
      return [adminClient];
    }
    return [];
  }
  if (pattern === "!@me" || pattern === "@!me") {
    return allInGame.filter((p) => p.index !== adminClient).map((p) => p.index);
  }
  if (pattern === "@bots") {
    return allInGame.filter((p) => p.IsBot()).map((p) => p.index);
  }
  if (pattern === "@humans") {
    return allInGame.filter((p) => !p.IsBot()).map((p) => p.index);
  }
  if (pattern === "@random") {
    if (allInGame.length === 0)
      return [];
    const rndIndex = Math.floor(Math.random() * allInGame.length);
    const chosen = allInGame[rndIndex];
    return chosen ? [chosen.index] : [];
  }
  if (pattern === "@aim") {
    const otherPlayers = allInGame.filter((p) => p.index !== adminClient);
    if (otherPlayers.length > 0) {
      return [otherPlayers[0].index];
    }
    return [];
  }
  if (targetPattern.startsWith("#")) {
    const userIdVal = parseInt(targetPattern.substring(1));
    if (!userIdVal || isNaN(userIdVal))
      return [];
    const match = allInGame.find((p) => p.userId === userIdVal);
    if (match) {
      return [match.index];
    }
  }
  const idxVal = parseInt(targetPattern);
  if (!isNaN(idxVal) && idxVal > 0 && idxVal <= GetContext().GetMaxClients() && GetContext().IsClientInGame(idxVal)) {
    return [idxVal];
  }
  const exactMatch = allInGame.find((p) => p.name === targetPattern);
  if (exactMatch) {
    return [exactMatch.index];
  }
  const exactMatchCI = allInGame.find((p) => p.name.toLowerCase() === pattern);
  if (exactMatchCI) {
    return [exactMatchCI.index];
  }
  const partialMatch = allInGame.filter((p) => p.name.toLowerCase().includes(pattern));
  if (partialMatch.length > 0) {
    return partialMatch.map((p) => p.index);
  }
  return [];
}
function IsPlayerObserver(client) {
  const p = GetContext().players.Get(client);
  return p ? p.IsObserver() : false;
}
function GetObserverTarget(client) {
  const p = GetContext().players.Get(client);
  return p ? p.GetObserverTarget() : 0;
}
function GetEntityFlags(client) {
  const p = GetContext().players.Get(client);
  return p ? p.GetEntityFlags() : 0;
}
function SetEntityVelocity(client, x, y, z) {
  const p = GetContext().players.Get(client);
  if (p) {
    p.SetVelocity(x, y, z);
  }
}
function GetEntityVelocity(client) {
  const p = GetContext().players.Get(client);
  return p ? p.GetVelocity() : { x: 0, y: 0, z: 0 };
}
function GetClientClanTag(client) {
  return GetContext().GetClientClanTag(client);
}
function SetClientClanTag(client, tag) {
  GetContext().SetClientClanTag(client, tag);
}
function IsClientForcedObserver(client) {
  return GetContext().IsClientForcedObserver(client);
}
function SetClientForcedObserver(client, forced) {
  GetContext().SetClientForcedObserver(client, forced);
}
function PrintHintText(client, message) {
  GetContext().PrintHintText(client, message);
}
function ClientCommand(client, cmd) {
  GetContext().ClientCommand(client, cmd);
}
var players;
var init_player = __esm(() => {
  init_context_store();
  init_enums();
  players = {
    Get(index) {
      return GetContext().players.Get(index);
    },
    FindByName(name) {
      return GetContext().players.FindByName(name);
    },
    FindBySteamId(steamId) {
      return GetContext().players.FindBySteamId(steamId);
    },
    GetAll() {
      return GetContext().players.GetAll();
    },
    GetClientsByTeam(team) {
      return GetContext().players.GetClientsByTeam(team);
    },
    GetAliveClients() {
      return GetContext().players.GetAliveClients();
    },
    GetInGameClients() {
      return GetContext().players.GetInGameClients();
    }
  };
});

// src/ts/natives/events.ts
function HookEvent(event, callback) {
  GetContext().HookEvent(event, callback);
}
var init_events = __esm(() => {
  init_context_store();
});

// src/ts/natives/timers.ts
function CreateTimer(ms, callback, repeat) {
  return GetContext().CreateTimer(ms, callback, repeat);
}
function KillTimer(timer) {
  GetContext().KillTimer(timer);
}
var init_timers = __esm(() => {
  init_context_store();
});

// src/ts/natives/menus.ts
function CreateMenu(title, callback) {
  return GetContext().CreateMenu(title, callback);
}
function CreateVote(question, options, callback, durationMs) {
  GetContext().CreateVote(question, options, callback, durationMs);
}
function CancelVote() {
  return GetContext().CancelVote();
}
var init_menus = __esm(() => {
  init_context_store();
});

// src/ts/natives/core.ts
var exports_core = {};
__export(exports_core, {
  players: () => players,
  TeleportEntity: () => TeleportEntity,
  Team: () => Team,
  Task: () => TaskRunner,
  TPrintToChat: () => TPrintToChat,
  SlapPlayer: () => SlapPlayer,
  SetWeaponAmmo: () => SetWeaponAmmo,
  SetEntityVelocity: () => SetEntityVelocity,
  SetEntityRenderColor: () => SetEntityRenderColor,
  SetEntityMoveType: () => SetEntityMoveType,
  SetEntityModel: () => SetEntityModel,
  SetEntityHealth: () => SetEntityHealth,
  SetEntityGravity: () => SetEntityGravity,
  SetClientForcedObserver: () => SetClientForcedObserver,
  SetClientClanTag: () => SetClientClanTag,
  ServerCommand: () => ServerCommand,
  SQL_TQuery: () => SQL_TQuery,
  SDKUnhook: () => SDKUnhook,
  SDKHook: () => SDKHook,
  RespawnPlayer: () => RespawnPlayer,
  ReplyToCommand: () => ReplyToCommand,
  ReplySource_Console: () => ReplySource_Console,
  ReplySource_Chat: () => ReplySource_Chat,
  ReplySource: () => ReplySource,
  RemovePlayerItem: () => RemovePlayerItem,
  RemoveCommandOverride: () => RemoveCommandOverride,
  RemoveBan: () => RemoveBan,
  RemoveAdmin: () => RemoveAdmin,
  ReloadAdmins: () => ReloadAdmins,
  RegisterAPI: () => RegisterAPI,
  RegConsoleCmd: () => RegConsoleCmd,
  RegClientCookie: () => RegClientCookie,
  ProcessTargetString: () => ProcessTargetString,
  PrintToConsole: () => PrintToConsole,
  PrintToChatAll: () => PrintToChatAll,
  PrintToChat: () => PrintToChat,
  PrintHintText: () => PrintHintText,
  Plugin_Stop: () => Plugin_Stop,
  Plugin_Handled: () => Plugin_Handled,
  Plugin_Continue: () => Plugin_Continue,
  Plugin_Changed: () => Plugin_Changed,
  LogToFile: () => LogToFile,
  LogMessage: () => LogMessage,
  LogAdminAction: () => LogAdminAction,
  LoadTranslations: () => LoadTranslations,
  KillTimer: () => KillTimer,
  KickClient: () => KickClient,
  IsPlayerObserver: () => IsPlayerObserver,
  IsPlayerAlive: () => IsPlayerAlive,
  IsClientInGame: () => IsClientInGame,
  IsClientForcedObserver: () => IsClientForcedObserver,
  HookEventPre: () => HookEventPre,
  HookEvent: () => HookEvent,
  Hook: () => Hook,
  HasAPI: () => HasAPI,
  GivePlayerItem: () => GivePlayerItem,
  GetUserFlagBits: () => GetUserFlagBits,
  GetTickrate: () => GetTickrate,
  GetTickInterval: () => GetTickInterval,
  GetObserverTarget: () => GetObserverTarget,
  GetMaxClients: () => GetMaxClients,
  GetEntityVelocity: () => GetEntityVelocity,
  GetEntityFlags: () => GetEntityFlags,
  GetEngineTime: () => GetEngineTime,
  GetCurrentMap: () => GetCurrentMap,
  GetCmdReplySource: () => GetCmdReplySource,
  GetClientWeapon: () => GetClientWeapon,
  GetClientUserId: () => GetClientUserId,
  GetClientTeam: () => GetClientTeam,
  GetClientName: () => GetClientName,
  GetClientMoney: () => GetClientMoney,
  GetClientHealth: () => GetClientHealth,
  GetClientCount: () => GetClientCount,
  GetClientClanTag: () => GetClientClanTag,
  GetClientAuthId: () => GetClientAuthId,
  GetBridgeLatency: () => GetBridgeLatency,
  GetAPIAsync: () => GetAPIAsync,
  GetAPI: () => GetAPI,
  FindConVar: () => FindConVar,
  FindClientCookie: () => FindClientCookie,
  EmitSoundToClient: () => EmitSoundToClient,
  EmitSoundToAll: () => EmitSoundToAll,
  CreateVote: () => CreateVote,
  CreateTimer: () => CreateTimer,
  CreateMenu: () => CreateMenu,
  CreateConVar: () => CreateConVar,
  CreateAdmin: () => CreateAdmin,
  Command: () => Command,
  ClientCommand: () => ClientCommand,
  CheckCommandAccess: () => CheckCommandAccess,
  ChangeClientTeam: () => ChangeClientTeam,
  CancelVote: () => CancelVote,
  CanAdminTarget: () => CanAdminTarget,
  BasePlugin: () => BasePlugin,
  BanClient: () => BanClient,
  AddCommandOverride: () => AddCommandOverride,
  AddAdminGroup: () => AddAdminGroup,
  Action: () => Action
});
function LogMessage(message) {
  GetContext().LogMessage(message);
}
function PrintToChat(client, message) {
  GetContext().PrintToChat(client, message);
}
function PrintToChatAll(message) {
  GetContext().PrintToChatAll(message);
}
function ReplyToCommand(client, message) {
  GetContext().ReplyToCommand(client, message);
}
function TPrintToChat(client, key, ...args) {
  GetContext().TPrintToChat(client, key, ...args);
}
function LoadTranslations(filename) {
  GetContext().LoadTranslations(filename);
}
function GetMaxClients() {
  return GetContext().GetMaxClients();
}
function GetClientCount(inGameOnly = true) {
  return GetContext().GetClientCount(inGameOnly);
}
function CreateAdmin(steamid, flags, immunity = 0, expiresAt = 0) {
  GetContext().adminManager.CreateAdmin(steamid, flags, immunity, expiresAt);
}
function RemoveAdmin(steamid) {
  GetContext().adminManager.RemoveAdmin(steamid);
}
function ReloadAdmins() {
  GetContext().adminManager.ReloadAdmins();
}
function AddAdminGroup(groupName, flags, immunity = 0, inherit) {
  GetContext().adminManager.AddAdminGroup(groupName, flags, immunity, inherit);
}
function LogToFile(filename, message) {
  GetContext().LogToFile(filename, message);
}
function LogAdminAction(admin, target, actionMessage) {
  const adminName = admin === 0 ? "Console" : GetContext().GetClientName(admin);
  const adminAuth = admin === 0 ? "STEAM_ID_SERVER" : GetContext().GetClientAuthId(admin);
  const adminString = `"${adminName}<${admin}><${adminAuth}>"`;
  let targetName = "";
  let targetAuth = "";
  let logMsg = "";
  if (target && target > 0 && GetContext().IsClientInGame(target)) {
    targetName = GetContext().GetClientName(target);
    targetAuth = GetContext().GetClientAuthId(target);
    const targetString = `"${targetName}<${target}><${targetAuth}>"`;
    logMsg = `${adminString} targeted ${targetString} with action: ${actionMessage}`;
  } else {
    logMsg = `${adminString} executed action: ${actionMessage}`;
  }
  GetContext().LogToFile("admin.log", logMsg);
  GetContext().adminManager.LogAction(adminAuth, adminName, targetAuth, targetName, actionMessage);
}
function AddCommandOverride(command, flags) {
  GetContext().adminManager.AddCommandOverride(command, flags);
}
function RemoveCommandOverride(command) {
  GetContext().adminManager.RemoveCommandOverride(command);
}
function CreateConVar(name, defaultValue, description) {
  return GetContext().CreateConVar(name, defaultValue, description);
}
function FindConVar(name) {
  return GetContext().FindConVar(name);
}
function RegClientCookie(name, description) {
  return GetContext().RegClientCookie(name, description);
}
function FindClientCookie(name) {
  return GetContext().FindClientCookie(name);
}
function SQL_TQuery(sql, args) {
  return GetContext().SQL_TQuery(sql, args);
}
function HookEventPre(event, callback) {
  GetContext().HookEventPre(event, callback);
}
function SDKHook(client, hookType, callback) {
  GetContext().SDKHook(client, hookType, callback);
}
function SDKUnhook(client, hookType, callback) {
  GetContext().SDKUnhook(client, hookType, callback);
}
function GetEngineTime() {
  return GetContext().GetEngineTime();
}
function GetTickrate() {
  return GetContext().GetTickrate();
}
function GetTickInterval() {
  return GetContext().GetTickInterval();
}
function RegisterAPI(name, api) {
  GetContext().RegisterAPI(name, api);
}
function HasAPI(name) {
  return GetContext().HasAPI(name);
}
function GetAPI(name) {
  return GetContext().GetAPI(name);
}
function GetAPIAsync(name) {
  return GetContext().GetAPIAsync(name);
}
function GetCurrentMap() {
  return GetContext().GetCurrentMap();
}
function GetBridgeLatency() {
  return GetContext().GetBridgeLatency();
}
var init_core = __esm(() => {
  init_context_store();
  init_enums();
  init_console();
  init_player();
  init_events();
  init_timers();
  init_menus();
});

// node_modules/@msgpack/msgpack/dist.esm/utils/utf8.mjs
function utf8Count(str) {
  const strLength = str.length;
  let byteLength = 0;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      byteLength++;
      continue;
    } else if ((value & 4294965248) === 0) {
      byteLength += 2;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        byteLength += 3;
      } else {
        byteLength += 4;
      }
    }
  }
  return byteLength;
}
function utf8EncodeJs(str, output, outputOffset) {
  const strLength = str.length;
  let offset = outputOffset;
  let pos = 0;
  while (pos < strLength) {
    let value = str.charCodeAt(pos++);
    if ((value & 4294967168) === 0) {
      output[offset++] = value;
      continue;
    } else if ((value & 4294965248) === 0) {
      output[offset++] = value >> 6 & 31 | 192;
    } else {
      if (value >= 55296 && value <= 56319) {
        if (pos < strLength) {
          const extra = str.charCodeAt(pos);
          if ((extra & 64512) === 56320) {
            ++pos;
            value = ((value & 1023) << 10) + (extra & 1023) + 65536;
          }
        }
      }
      if ((value & 4294901760) === 0) {
        output[offset++] = value >> 12 & 15 | 224;
        output[offset++] = value >> 6 & 63 | 128;
      } else {
        output[offset++] = value >> 18 & 7 | 240;
        output[offset++] = value >> 12 & 63 | 128;
        output[offset++] = value >> 6 & 63 | 128;
      }
    }
    output[offset++] = value & 63 | 128;
  }
}
var sharedTextEncoder = new TextEncoder;
var TEXT_ENCODER_THRESHOLD = 50;
function utf8EncodeTE(str, output, outputOffset) {
  sharedTextEncoder.encodeInto(str, output.subarray(outputOffset));
}
function utf8Encode(str, output, outputOffset) {
  if (str.length > TEXT_ENCODER_THRESHOLD) {
    utf8EncodeTE(str, output, outputOffset);
  } else {
    utf8EncodeJs(str, output, outputOffset);
  }
}
var CHUNK_SIZE = 4096;
function utf8DecodeJs(bytes, inputOffset, byteLength) {
  let offset = inputOffset;
  const end = offset + byteLength;
  const units = [];
  let result = "";
  while (offset < end) {
    const byte1 = bytes[offset++];
    if ((byte1 & 128) === 0) {
      units.push(byte1);
    } else if ((byte1 & 224) === 192) {
      const byte2 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 6 | byte2);
    } else if ((byte1 & 240) === 224) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      units.push((byte1 & 31) << 12 | byte2 << 6 | byte3);
    } else if ((byte1 & 248) === 240) {
      const byte2 = bytes[offset++] & 63;
      const byte3 = bytes[offset++] & 63;
      const byte4 = bytes[offset++] & 63;
      let unit = (byte1 & 7) << 18 | byte2 << 12 | byte3 << 6 | byte4;
      if (unit > 65535) {
        unit -= 65536;
        units.push(unit >>> 10 & 1023 | 55296);
        unit = 56320 | unit & 1023;
      }
      units.push(unit);
    } else {
      units.push(byte1);
    }
    if (units.length >= CHUNK_SIZE) {
      result += String.fromCharCode(...units);
      units.length = 0;
    }
  }
  if (units.length > 0) {
    result += String.fromCharCode(...units);
  }
  return result;
}
var sharedTextDecoder = new TextDecoder;
var TEXT_DECODER_THRESHOLD = 200;
function utf8DecodeTD(bytes, inputOffset, byteLength) {
  const stringBytes = bytes.subarray(inputOffset, inputOffset + byteLength);
  return sharedTextDecoder.decode(stringBytes);
}
function utf8Decode(bytes, inputOffset, byteLength) {
  if (byteLength > TEXT_DECODER_THRESHOLD) {
    return utf8DecodeTD(bytes, inputOffset, byteLength);
  } else {
    return utf8DecodeJs(bytes, inputOffset, byteLength);
  }
}

// node_modules/@msgpack/msgpack/dist.esm/ExtData.mjs
class ExtData {
  type;
  data;
  constructor(type, data) {
    this.type = type;
    this.data = data;
  }
}

// node_modules/@msgpack/msgpack/dist.esm/DecodeError.mjs
class DecodeError extends Error {
  constructor(message) {
    super(message);
    const proto = Object.create(DecodeError.prototype);
    Object.setPrototypeOf(this, proto);
    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: DecodeError.name
    });
  }
}

// node_modules/@msgpack/msgpack/dist.esm/utils/int.mjs
var UINT32_MAX = 4294967295;
function setUint64(view, offset, value) {
  const high = value / 4294967296;
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function setInt64(view, offset, value) {
  const high = Math.floor(value / 4294967296);
  const low = value;
  view.setUint32(offset, high);
  view.setUint32(offset + 4, low);
}
function getInt64(view, offset) {
  const high = view.getInt32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}
function getUint64(view, offset) {
  const high = view.getUint32(offset);
  const low = view.getUint32(offset + 4);
  return high * 4294967296 + low;
}

// node_modules/@msgpack/msgpack/dist.esm/timestamp.mjs
var EXT_TIMESTAMP = -1;
var TIMESTAMP32_MAX_SEC = 4294967296 - 1;
var TIMESTAMP64_MAX_SEC = 17179869184 - 1;
function encodeTimeSpecToTimestamp({ sec, nsec }) {
  if (sec >= 0 && nsec >= 0 && sec <= TIMESTAMP64_MAX_SEC) {
    if (nsec === 0 && sec <= TIMESTAMP32_MAX_SEC) {
      const rv = new Uint8Array(4);
      const view = new DataView(rv.buffer);
      view.setUint32(0, sec);
      return rv;
    } else {
      const secHigh = sec / 4294967296;
      const secLow = sec & 4294967295;
      const rv = new Uint8Array(8);
      const view = new DataView(rv.buffer);
      view.setUint32(0, nsec << 2 | secHigh & 3);
      view.setUint32(4, secLow);
      return rv;
    }
  } else {
    const rv = new Uint8Array(12);
    const view = new DataView(rv.buffer);
    view.setUint32(0, nsec);
    setInt64(view, 4, sec);
    return rv;
  }
}
function encodeDateToTimeSpec(date) {
  const msec = date.getTime();
  const sec = Math.floor(msec / 1000);
  const nsec = (msec - sec * 1000) * 1e6;
  const nsecInSec = Math.floor(nsec / 1e9);
  return {
    sec: sec + nsecInSec,
    nsec: nsec - nsecInSec * 1e9
  };
}
function encodeTimestampExtension(object) {
  if (object instanceof Date) {
    const timeSpec = encodeDateToTimeSpec(object);
    return encodeTimeSpecToTimestamp(timeSpec);
  } else {
    return null;
  }
}
function decodeTimestampToTimeSpec(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  switch (data.byteLength) {
    case 4: {
      const sec = view.getUint32(0);
      const nsec = 0;
      return { sec, nsec };
    }
    case 8: {
      const nsec30AndSecHigh2 = view.getUint32(0);
      const secLow32 = view.getUint32(4);
      const sec = (nsec30AndSecHigh2 & 3) * 4294967296 + secLow32;
      const nsec = nsec30AndSecHigh2 >>> 2;
      return { sec, nsec };
    }
    case 12: {
      const sec = getInt64(view, 4);
      const nsec = view.getUint32(0);
      return { sec, nsec };
    }
    default:
      throw new DecodeError(`Unrecognized data size for timestamp (expected 4, 8, or 12): ${data.length}`);
  }
}
function decodeTimestampExtension(data) {
  const timeSpec = decodeTimestampToTimeSpec(data);
  return new Date(timeSpec.sec * 1000 + timeSpec.nsec / 1e6);
}
var timestampExtension = {
  type: EXT_TIMESTAMP,
  encode: encodeTimestampExtension,
  decode: decodeTimestampExtension
};

// node_modules/@msgpack/msgpack/dist.esm/ExtensionCodec.mjs
class ExtensionCodec {
  static defaultCodec = new ExtensionCodec;
  __brand;
  builtInEncoders = [];
  builtInDecoders = [];
  encoders = [];
  decoders = [];
  constructor() {
    this.register(timestampExtension);
  }
  register({ type, encode, decode }) {
    if (type >= 0) {
      this.encoders[type] = encode;
      this.decoders[type] = decode;
    } else {
      const index = -1 - type;
      this.builtInEncoders[index] = encode;
      this.builtInDecoders[index] = decode;
    }
  }
  tryToEncode(object, context) {
    for (let i = 0;i < this.builtInEncoders.length; i++) {
      const encodeExt = this.builtInEncoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = -1 - i;
          return new ExtData(type, data);
        }
      }
    }
    for (let i = 0;i < this.encoders.length; i++) {
      const encodeExt = this.encoders[i];
      if (encodeExt != null) {
        const data = encodeExt(object, context);
        if (data != null) {
          const type = i;
          return new ExtData(type, data);
        }
      }
    }
    if (object instanceof ExtData) {
      return object;
    }
    return null;
  }
  decode(data, type, context) {
    const decodeExt = type < 0 ? this.builtInDecoders[-1 - type] : this.decoders[type];
    if (decodeExt) {
      return decodeExt(data, type, context);
    } else {
      return new ExtData(type, data);
    }
  }
}

// node_modules/@msgpack/msgpack/dist.esm/utils/typedArrays.mjs
function isArrayBufferLike(buffer) {
  return buffer instanceof ArrayBuffer || typeof SharedArrayBuffer !== "undefined" && buffer instanceof SharedArrayBuffer;
}
function ensureUint8Array(buffer) {
  if (buffer instanceof Uint8Array) {
    return buffer;
  } else if (ArrayBuffer.isView(buffer)) {
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  } else if (isArrayBufferLike(buffer)) {
    return new Uint8Array(buffer);
  } else {
    return Uint8Array.from(buffer);
  }
}

// node_modules/@msgpack/msgpack/dist.esm/Encoder.mjs
var DEFAULT_MAX_DEPTH = 100;
var DEFAULT_INITIAL_BUFFER_SIZE = 2048;

class Encoder {
  extensionCodec;
  context;
  useBigInt64;
  maxDepth;
  initialBufferSize;
  sortKeys;
  forceFloat32;
  ignoreUndefined;
  forceIntegerToFloat;
  pos;
  view;
  bytes;
  entered = false;
  constructor(options) {
    this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
    this.context = options?.context;
    this.useBigInt64 = options?.useBigInt64 ?? false;
    this.maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    this.initialBufferSize = options?.initialBufferSize ?? DEFAULT_INITIAL_BUFFER_SIZE;
    this.sortKeys = options?.sortKeys ?? false;
    this.forceFloat32 = options?.forceFloat32 ?? false;
    this.ignoreUndefined = options?.ignoreUndefined ?? false;
    this.forceIntegerToFloat = options?.forceIntegerToFloat ?? false;
    this.pos = 0;
    this.view = new DataView(new ArrayBuffer(this.initialBufferSize));
    this.bytes = new Uint8Array(this.view.buffer);
  }
  clone() {
    return new Encoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      maxDepth: this.maxDepth,
      initialBufferSize: this.initialBufferSize,
      sortKeys: this.sortKeys,
      forceFloat32: this.forceFloat32,
      ignoreUndefined: this.ignoreUndefined,
      forceIntegerToFloat: this.forceIntegerToFloat
    });
  }
  reinitializeState() {
    this.pos = 0;
  }
  encodeSharedRef(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encodeSharedRef(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.subarray(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  encode(object) {
    if (this.entered) {
      const instance = this.clone();
      return instance.encode(object);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.doEncode(object, 1);
      return this.bytes.slice(0, this.pos);
    } finally {
      this.entered = false;
    }
  }
  doEncode(object, depth) {
    if (depth > this.maxDepth) {
      throw new Error(`Too deep objects in depth ${depth}`);
    }
    if (object == null) {
      this.encodeNil();
    } else if (typeof object === "boolean") {
      this.encodeBoolean(object);
    } else if (typeof object === "number") {
      if (!this.forceIntegerToFloat) {
        this.encodeNumber(object);
      } else {
        this.encodeNumberAsFloat(object);
      }
    } else if (typeof object === "string") {
      this.encodeString(object);
    } else if (this.useBigInt64 && typeof object === "bigint") {
      this.encodeBigInt64(object);
    } else {
      this.encodeObject(object, depth);
    }
  }
  ensureBufferSizeToWrite(sizeToWrite) {
    const requiredSize = this.pos + sizeToWrite;
    if (this.view.byteLength < requiredSize) {
      this.resizeBuffer(requiredSize * 2);
    }
  }
  resizeBuffer(newSize) {
    const newBuffer = new ArrayBuffer(newSize);
    const newBytes = new Uint8Array(newBuffer);
    const newView = new DataView(newBuffer);
    newBytes.set(this.bytes);
    this.view = newView;
    this.bytes = newBytes;
  }
  encodeNil() {
    this.writeU8(192);
  }
  encodeBoolean(object) {
    if (object === false) {
      this.writeU8(194);
    } else {
      this.writeU8(195);
    }
  }
  encodeNumber(object) {
    if (!this.forceIntegerToFloat && Number.isSafeInteger(object)) {
      if (object >= 0) {
        if (object < 128) {
          this.writeU8(object);
        } else if (object < 256) {
          this.writeU8(204);
          this.writeU8(object);
        } else if (object < 65536) {
          this.writeU8(205);
          this.writeU16(object);
        } else if (object < 4294967296) {
          this.writeU8(206);
          this.writeU32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(207);
          this.writeU64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      } else {
        if (object >= -32) {
          this.writeU8(224 | object + 32);
        } else if (object >= -128) {
          this.writeU8(208);
          this.writeI8(object);
        } else if (object >= -32768) {
          this.writeU8(209);
          this.writeI16(object);
        } else if (object >= -2147483648) {
          this.writeU8(210);
          this.writeI32(object);
        } else if (!this.useBigInt64) {
          this.writeU8(211);
          this.writeI64(object);
        } else {
          this.encodeNumberAsFloat(object);
        }
      }
    } else {
      this.encodeNumberAsFloat(object);
    }
  }
  encodeNumberAsFloat(object) {
    if (this.forceFloat32) {
      this.writeU8(202);
      this.writeF32(object);
    } else {
      this.writeU8(203);
      this.writeF64(object);
    }
  }
  encodeBigInt64(object) {
    if (object >= BigInt(0)) {
      this.writeU8(207);
      this.writeBigUint64(object);
    } else {
      this.writeU8(211);
      this.writeBigInt64(object);
    }
  }
  writeStringHeader(byteLength) {
    if (byteLength < 32) {
      this.writeU8(160 + byteLength);
    } else if (byteLength < 256) {
      this.writeU8(217);
      this.writeU8(byteLength);
    } else if (byteLength < 65536) {
      this.writeU8(218);
      this.writeU16(byteLength);
    } else if (byteLength < 4294967296) {
      this.writeU8(219);
      this.writeU32(byteLength);
    } else {
      throw new Error(`Too long string: ${byteLength} bytes in UTF-8`);
    }
  }
  encodeString(object) {
    const maxHeaderSize = 1 + 4;
    const byteLength = utf8Count(object);
    this.ensureBufferSizeToWrite(maxHeaderSize + byteLength);
    this.writeStringHeader(byteLength);
    utf8Encode(object, this.bytes, this.pos);
    this.pos += byteLength;
  }
  encodeObject(object, depth) {
    const ext = this.extensionCodec.tryToEncode(object, this.context);
    if (ext != null) {
      this.encodeExtension(ext);
    } else if (Array.isArray(object)) {
      this.encodeArray(object, depth);
    } else if (ArrayBuffer.isView(object)) {
      this.encodeBinary(object);
    } else if (typeof object === "object") {
      this.encodeMap(object, depth);
    } else {
      throw new Error(`Unrecognized object: ${Object.prototype.toString.apply(object)}`);
    }
  }
  encodeBinary(object) {
    const size = object.byteLength;
    if (size < 256) {
      this.writeU8(196);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(197);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(198);
      this.writeU32(size);
    } else {
      throw new Error(`Too large binary: ${size}`);
    }
    const bytes = ensureUint8Array(object);
    this.writeU8a(bytes);
  }
  encodeArray(object, depth) {
    const size = object.length;
    if (size < 16) {
      this.writeU8(144 + size);
    } else if (size < 65536) {
      this.writeU8(220);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(221);
      this.writeU32(size);
    } else {
      throw new Error(`Too large array: ${size}`);
    }
    for (const item of object) {
      this.doEncode(item, depth + 1);
    }
  }
  countWithoutUndefined(object, keys) {
    let count = 0;
    for (const key of keys) {
      if (object[key] !== undefined) {
        count++;
      }
    }
    return count;
  }
  encodeMap(object, depth) {
    const keys = Object.keys(object);
    if (this.sortKeys) {
      keys.sort();
    }
    const size = this.ignoreUndefined ? this.countWithoutUndefined(object, keys) : keys.length;
    if (size < 16) {
      this.writeU8(128 + size);
    } else if (size < 65536) {
      this.writeU8(222);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(223);
      this.writeU32(size);
    } else {
      throw new Error(`Too large map object: ${size}`);
    }
    for (const key of keys) {
      const value = object[key];
      if (!(this.ignoreUndefined && value === undefined)) {
        this.encodeString(key);
        this.doEncode(value, depth + 1);
      }
    }
  }
  encodeExtension(ext) {
    if (typeof ext.data === "function") {
      const data = ext.data(this.pos + 6);
      const size2 = data.length;
      if (size2 >= 4294967296) {
        throw new Error(`Too large extension object: ${size2}`);
      }
      this.writeU8(201);
      this.writeU32(size2);
      this.writeI8(ext.type);
      this.writeU8a(data);
      return;
    }
    const size = ext.data.length;
    if (size === 1) {
      this.writeU8(212);
    } else if (size === 2) {
      this.writeU8(213);
    } else if (size === 4) {
      this.writeU8(214);
    } else if (size === 8) {
      this.writeU8(215);
    } else if (size === 16) {
      this.writeU8(216);
    } else if (size < 256) {
      this.writeU8(199);
      this.writeU8(size);
    } else if (size < 65536) {
      this.writeU8(200);
      this.writeU16(size);
    } else if (size < 4294967296) {
      this.writeU8(201);
      this.writeU32(size);
    } else {
      throw new Error(`Too large extension object: ${size}`);
    }
    this.writeI8(ext.type);
    this.writeU8a(ext.data);
  }
  writeU8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setUint8(this.pos, value);
    this.pos++;
  }
  writeU8a(values) {
    const size = values.length;
    this.ensureBufferSizeToWrite(size);
    this.bytes.set(values, this.pos);
    this.pos += size;
  }
  writeI8(value) {
    this.ensureBufferSizeToWrite(1);
    this.view.setInt8(this.pos, value);
    this.pos++;
  }
  writeU16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  writeI16(value) {
    this.ensureBufferSizeToWrite(2);
    this.view.setInt16(this.pos, value);
    this.pos += 2;
  }
  writeU32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setUint32(this.pos, value);
    this.pos += 4;
  }
  writeI32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setInt32(this.pos, value);
    this.pos += 4;
  }
  writeF32(value) {
    this.ensureBufferSizeToWrite(4);
    this.view.setFloat32(this.pos, value);
    this.pos += 4;
  }
  writeF64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setFloat64(this.pos, value);
    this.pos += 8;
  }
  writeU64(value) {
    this.ensureBufferSizeToWrite(8);
    setUint64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeI64(value) {
    this.ensureBufferSizeToWrite(8);
    setInt64(this.view, this.pos, value);
    this.pos += 8;
  }
  writeBigUint64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigUint64(this.pos, value);
    this.pos += 8;
  }
  writeBigInt64(value) {
    this.ensureBufferSizeToWrite(8);
    this.view.setBigInt64(this.pos, value);
    this.pos += 8;
  }
}

// node_modules/@msgpack/msgpack/dist.esm/encode.mjs
function encode(value, options) {
  const encoder = new Encoder(options);
  return encoder.encodeSharedRef(value);
}

// node_modules/@msgpack/msgpack/dist.esm/utils/prettyByte.mjs
function prettyByte(byte) {
  return `${byte < 0 ? "-" : ""}0x${Math.abs(byte).toString(16).padStart(2, "0")}`;
}

// node_modules/@msgpack/msgpack/dist.esm/CachedKeyDecoder.mjs
var DEFAULT_MAX_KEY_LENGTH = 16;
var DEFAULT_MAX_LENGTH_PER_KEY = 16;

class CachedKeyDecoder {
  hit = 0;
  miss = 0;
  caches;
  maxKeyLength;
  maxLengthPerKey;
  constructor(maxKeyLength = DEFAULT_MAX_KEY_LENGTH, maxLengthPerKey = DEFAULT_MAX_LENGTH_PER_KEY) {
    this.maxKeyLength = maxKeyLength;
    this.maxLengthPerKey = maxLengthPerKey;
    this.caches = [];
    for (let i = 0;i < this.maxKeyLength; i++) {
      this.caches.push([]);
    }
  }
  canBeCached(byteLength) {
    return byteLength > 0 && byteLength <= this.maxKeyLength;
  }
  find(bytes, inputOffset, byteLength) {
    const records = this.caches[byteLength - 1];
    FIND_CHUNK:
      for (const record of records) {
        const recordBytes = record.bytes;
        for (let j = 0;j < byteLength; j++) {
          if (recordBytes[j] !== bytes[inputOffset + j]) {
            continue FIND_CHUNK;
          }
        }
        return record.str;
      }
    return null;
  }
  store(bytes, value) {
    const records = this.caches[bytes.length - 1];
    const record = { bytes, str: value };
    if (records.length >= this.maxLengthPerKey) {
      records[Math.random() * records.length | 0] = record;
    } else {
      records.push(record);
    }
  }
  decode(bytes, inputOffset, byteLength) {
    const cachedValue = this.find(bytes, inputOffset, byteLength);
    if (cachedValue != null) {
      this.hit++;
      return cachedValue;
    }
    this.miss++;
    const str = utf8DecodeJs(bytes, inputOffset, byteLength);
    const slicedCopyOfBytes = Uint8Array.prototype.slice.call(bytes, inputOffset, inputOffset + byteLength);
    this.store(slicedCopyOfBytes, str);
    return str;
  }
}

// node_modules/@msgpack/msgpack/dist.esm/Decoder.mjs
var STATE_ARRAY = "array";
var STATE_MAP_KEY = "map_key";
var STATE_MAP_VALUE = "map_value";
var mapKeyConverter = (key) => {
  if (typeof key === "string" || typeof key === "number") {
    return key;
  }
  throw new DecodeError("The type of key must be string or number but " + typeof key);
};

class StackPool {
  stack = [];
  stackHeadPosition = -1;
  get length() {
    return this.stackHeadPosition + 1;
  }
  top() {
    return this.stack[this.stackHeadPosition];
  }
  pushArrayState(size) {
    const state = this.getUninitializedStateFromPool();
    state.type = STATE_ARRAY;
    state.position = 0;
    state.size = size;
    state.array = new Array(size);
  }
  pushMapState(size) {
    const state = this.getUninitializedStateFromPool();
    state.type = STATE_MAP_KEY;
    state.readCount = 0;
    state.size = size;
    state.map = {};
  }
  getUninitializedStateFromPool() {
    this.stackHeadPosition++;
    if (this.stackHeadPosition === this.stack.length) {
      const partialState = {
        type: undefined,
        size: 0,
        array: undefined,
        position: 0,
        readCount: 0,
        map: undefined,
        key: null
      };
      this.stack.push(partialState);
    }
    return this.stack[this.stackHeadPosition];
  }
  release(state) {
    const topStackState = this.stack[this.stackHeadPosition];
    if (topStackState !== state) {
      throw new Error("Invalid stack state. Released state is not on top of the stack.");
    }
    if (state.type === STATE_ARRAY) {
      const partialState = state;
      partialState.size = 0;
      partialState.array = undefined;
      partialState.position = 0;
      partialState.type = undefined;
    }
    if (state.type === STATE_MAP_KEY || state.type === STATE_MAP_VALUE) {
      const partialState = state;
      partialState.size = 0;
      partialState.map = undefined;
      partialState.readCount = 0;
      partialState.type = undefined;
    }
    this.stackHeadPosition--;
  }
  reset() {
    this.stack.length = 0;
    this.stackHeadPosition = -1;
  }
}
var HEAD_BYTE_REQUIRED = -1;
var EMPTY_VIEW = new DataView(new ArrayBuffer(0));
var EMPTY_BYTES = new Uint8Array(EMPTY_VIEW.buffer);
try {
  EMPTY_VIEW.getInt8(0);
} catch (e) {
  if (!(e instanceof RangeError)) {
    throw new Error("This module is not supported in the current JavaScript engine because DataView does not throw RangeError on out-of-bounds access");
  }
}
var MORE_DATA = new RangeError("Insufficient data");
var sharedCachedKeyDecoder = new CachedKeyDecoder;

class Decoder {
  extensionCodec;
  context;
  useBigInt64;
  rawStrings;
  maxStrLength;
  maxBinLength;
  maxArrayLength;
  maxMapLength;
  maxExtLength;
  keyDecoder;
  mapKeyConverter;
  totalPos = 0;
  pos = 0;
  view = EMPTY_VIEW;
  bytes = EMPTY_BYTES;
  headByte = HEAD_BYTE_REQUIRED;
  stack = new StackPool;
  entered = false;
  constructor(options) {
    this.extensionCodec = options?.extensionCodec ?? ExtensionCodec.defaultCodec;
    this.context = options?.context;
    this.useBigInt64 = options?.useBigInt64 ?? false;
    this.rawStrings = options?.rawStrings ?? false;
    this.maxStrLength = options?.maxStrLength ?? UINT32_MAX;
    this.maxBinLength = options?.maxBinLength ?? UINT32_MAX;
    this.maxArrayLength = options?.maxArrayLength ?? UINT32_MAX;
    this.maxMapLength = options?.maxMapLength ?? UINT32_MAX;
    this.maxExtLength = options?.maxExtLength ?? UINT32_MAX;
    this.keyDecoder = options?.keyDecoder !== undefined ? options.keyDecoder : sharedCachedKeyDecoder;
    this.mapKeyConverter = options?.mapKeyConverter ?? mapKeyConverter;
  }
  clone() {
    return new Decoder({
      extensionCodec: this.extensionCodec,
      context: this.context,
      useBigInt64: this.useBigInt64,
      rawStrings: this.rawStrings,
      maxStrLength: this.maxStrLength,
      maxBinLength: this.maxBinLength,
      maxArrayLength: this.maxArrayLength,
      maxMapLength: this.maxMapLength,
      maxExtLength: this.maxExtLength,
      keyDecoder: this.keyDecoder
    });
  }
  reinitializeState() {
    this.totalPos = 0;
    this.headByte = HEAD_BYTE_REQUIRED;
    this.stack.reset();
  }
  setBuffer(buffer) {
    const bytes = ensureUint8Array(buffer);
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  appendBuffer(buffer) {
    if (this.headByte === HEAD_BYTE_REQUIRED && !this.hasRemaining(1)) {
      this.setBuffer(buffer);
    } else {
      const remainingData = this.bytes.subarray(this.pos);
      const newData = ensureUint8Array(buffer);
      const newBuffer = new Uint8Array(remainingData.length + newData.length);
      newBuffer.set(remainingData);
      newBuffer.set(newData, remainingData.length);
      this.setBuffer(newBuffer);
    }
  }
  hasRemaining(size) {
    return this.view.byteLength - this.pos >= size;
  }
  createExtraByteError(posToShow) {
    const { view, pos } = this;
    return new RangeError(`Extra ${view.byteLength - pos} of ${view.byteLength} byte(s) found at buffer[${posToShow}]`);
  }
  decode(buffer) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decode(buffer);
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      const object = this.doDecodeSync();
      if (this.hasRemaining(1)) {
        throw this.createExtraByteError(this.pos);
      }
      return object;
    } finally {
      this.entered = false;
    }
  }
  *decodeMulti(buffer) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMulti(buffer);
      return;
    }
    try {
      this.entered = true;
      this.reinitializeState();
      this.setBuffer(buffer);
      while (this.hasRemaining(1)) {
        yield this.doDecodeSync();
      }
    } finally {
      this.entered = false;
    }
  }
  async decodeAsync(stream) {
    if (this.entered) {
      const instance = this.clone();
      return instance.decodeAsync(stream);
    }
    try {
      this.entered = true;
      let decoded = false;
      let object;
      for await (const buffer of stream) {
        if (decoded) {
          this.entered = false;
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        try {
          object = this.doDecodeSync();
          decoded = true;
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
      if (decoded) {
        if (this.hasRemaining(1)) {
          throw this.createExtraByteError(this.totalPos);
        }
        return object;
      }
      const { headByte, pos, totalPos } = this;
      throw new RangeError(`Insufficient data in parsing ${prettyByte(headByte)} at ${totalPos} (${pos} in the current buffer)`);
    } finally {
      this.entered = false;
    }
  }
  decodeArrayStream(stream) {
    return this.decodeMultiAsync(stream, true);
  }
  decodeStream(stream) {
    return this.decodeMultiAsync(stream, false);
  }
  async* decodeMultiAsync(stream, isArray) {
    if (this.entered) {
      const instance = this.clone();
      yield* instance.decodeMultiAsync(stream, isArray);
      return;
    }
    try {
      this.entered = true;
      let isArrayHeaderRequired = isArray;
      let arrayItemsLeft = -1;
      for await (const buffer of stream) {
        if (isArray && arrayItemsLeft === 0) {
          throw this.createExtraByteError(this.totalPos);
        }
        this.appendBuffer(buffer);
        if (isArrayHeaderRequired) {
          arrayItemsLeft = this.readArraySize();
          isArrayHeaderRequired = false;
          this.complete();
        }
        try {
          while (true) {
            yield this.doDecodeSync();
            if (--arrayItemsLeft === 0) {
              break;
            }
          }
        } catch (e) {
          if (!(e instanceof RangeError)) {
            throw e;
          }
        }
        this.totalPos += this.pos;
      }
    } finally {
      this.entered = false;
    }
  }
  doDecodeSync() {
    DECODE:
      while (true) {
        const headByte = this.readHeadByte();
        let object;
        if (headByte >= 224) {
          object = headByte - 256;
        } else if (headByte < 192) {
          if (headByte < 128) {
            object = headByte;
          } else if (headByte < 144) {
            const size = headByte - 128;
            if (size !== 0) {
              this.pushMapState(size);
              this.complete();
              continue DECODE;
            } else {
              object = {};
            }
          } else if (headByte < 160) {
            const size = headByte - 144;
            if (size !== 0) {
              this.pushArrayState(size);
              this.complete();
              continue DECODE;
            } else {
              object = [];
            }
          } else {
            const byteLength = headByte - 160;
            object = this.decodeString(byteLength, 0);
          }
        } else if (headByte === 192) {
          object = null;
        } else if (headByte === 194) {
          object = false;
        } else if (headByte === 195) {
          object = true;
        } else if (headByte === 202) {
          object = this.readF32();
        } else if (headByte === 203) {
          object = this.readF64();
        } else if (headByte === 204) {
          object = this.readU8();
        } else if (headByte === 205) {
          object = this.readU16();
        } else if (headByte === 206) {
          object = this.readU32();
        } else if (headByte === 207) {
          if (this.useBigInt64) {
            object = this.readU64AsBigInt();
          } else {
            object = this.readU64();
          }
        } else if (headByte === 208) {
          object = this.readI8();
        } else if (headByte === 209) {
          object = this.readI16();
        } else if (headByte === 210) {
          object = this.readI32();
        } else if (headByte === 211) {
          if (this.useBigInt64) {
            object = this.readI64AsBigInt();
          } else {
            object = this.readI64();
          }
        } else if (headByte === 217) {
          const byteLength = this.lookU8();
          object = this.decodeString(byteLength, 1);
        } else if (headByte === 218) {
          const byteLength = this.lookU16();
          object = this.decodeString(byteLength, 2);
        } else if (headByte === 219) {
          const byteLength = this.lookU32();
          object = this.decodeString(byteLength, 4);
        } else if (headByte === 220) {
          const size = this.readU16();
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else if (headByte === 221) {
          const size = this.readU32();
          if (size !== 0) {
            this.pushArrayState(size);
            this.complete();
            continue DECODE;
          } else {
            object = [];
          }
        } else if (headByte === 222) {
          const size = this.readU16();
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte === 223) {
          const size = this.readU32();
          if (size !== 0) {
            this.pushMapState(size);
            this.complete();
            continue DECODE;
          } else {
            object = {};
          }
        } else if (headByte === 196) {
          const size = this.lookU8();
          object = this.decodeBinary(size, 1);
        } else if (headByte === 197) {
          const size = this.lookU16();
          object = this.decodeBinary(size, 2);
        } else if (headByte === 198) {
          const size = this.lookU32();
          object = this.decodeBinary(size, 4);
        } else if (headByte === 212) {
          object = this.decodeExtension(1, 0);
        } else if (headByte === 213) {
          object = this.decodeExtension(2, 0);
        } else if (headByte === 214) {
          object = this.decodeExtension(4, 0);
        } else if (headByte === 215) {
          object = this.decodeExtension(8, 0);
        } else if (headByte === 216) {
          object = this.decodeExtension(16, 0);
        } else if (headByte === 199) {
          const size = this.lookU8();
          object = this.decodeExtension(size, 1);
        } else if (headByte === 200) {
          const size = this.lookU16();
          object = this.decodeExtension(size, 2);
        } else if (headByte === 201) {
          const size = this.lookU32();
          object = this.decodeExtension(size, 4);
        } else {
          throw new DecodeError(`Unrecognized type byte: ${prettyByte(headByte)}`);
        }
        this.complete();
        const stack = this.stack;
        while (stack.length > 0) {
          const state = stack.top();
          if (state.type === STATE_ARRAY) {
            state.array[state.position] = object;
            state.position++;
            if (state.position === state.size) {
              object = state.array;
              stack.release(state);
            } else {
              continue DECODE;
            }
          } else if (state.type === STATE_MAP_KEY) {
            if (object === "__proto__") {
              throw new DecodeError("The key __proto__ is not allowed");
            }
            state.key = this.mapKeyConverter(object);
            state.type = STATE_MAP_VALUE;
            continue DECODE;
          } else {
            state.map[state.key] = object;
            state.readCount++;
            if (state.readCount === state.size) {
              object = state.map;
              stack.release(state);
            } else {
              state.key = null;
              state.type = STATE_MAP_KEY;
              continue DECODE;
            }
          }
        }
        return object;
      }
  }
  readHeadByte() {
    if (this.headByte === HEAD_BYTE_REQUIRED) {
      this.headByte = this.readU8();
    }
    return this.headByte;
  }
  complete() {
    this.headByte = HEAD_BYTE_REQUIRED;
  }
  readArraySize() {
    const headByte = this.readHeadByte();
    switch (headByte) {
      case 220:
        return this.readU16();
      case 221:
        return this.readU32();
      default: {
        if (headByte < 160) {
          return headByte - 144;
        } else {
          throw new DecodeError(`Unrecognized array type byte: ${prettyByte(headByte)}`);
        }
      }
    }
  }
  pushMapState(size) {
    if (size > this.maxMapLength) {
      throw new DecodeError(`Max length exceeded: map length (${size}) > maxMapLengthLength (${this.maxMapLength})`);
    }
    this.stack.pushMapState(size);
  }
  pushArrayState(size) {
    if (size > this.maxArrayLength) {
      throw new DecodeError(`Max length exceeded: array length (${size}) > maxArrayLength (${this.maxArrayLength})`);
    }
    this.stack.pushArrayState(size);
  }
  decodeString(byteLength, headerOffset) {
    if (!this.rawStrings || this.stateIsMapKey()) {
      return this.decodeUtf8String(byteLength, headerOffset);
    }
    return this.decodeBinary(byteLength, headerOffset);
  }
  decodeUtf8String(byteLength, headerOffset) {
    if (byteLength > this.maxStrLength) {
      throw new DecodeError(`Max length exceeded: UTF-8 byte length (${byteLength}) > maxStrLength (${this.maxStrLength})`);
    }
    if (this.bytes.byteLength < this.pos + headerOffset + byteLength) {
      throw MORE_DATA;
    }
    const offset = this.pos + headerOffset;
    let object;
    if (this.stateIsMapKey() && this.keyDecoder?.canBeCached(byteLength)) {
      object = this.keyDecoder.decode(this.bytes, offset, byteLength);
    } else {
      object = utf8Decode(this.bytes, offset, byteLength);
    }
    this.pos += headerOffset + byteLength;
    return object;
  }
  stateIsMapKey() {
    if (this.stack.length > 0) {
      const state = this.stack.top();
      return state.type === STATE_MAP_KEY;
    }
    return false;
  }
  decodeBinary(byteLength, headOffset) {
    if (byteLength > this.maxBinLength) {
      throw new DecodeError(`Max length exceeded: bin length (${byteLength}) > maxBinLength (${this.maxBinLength})`);
    }
    if (!this.hasRemaining(byteLength + headOffset)) {
      throw MORE_DATA;
    }
    const offset = this.pos + headOffset;
    const object = this.bytes.subarray(offset, offset + byteLength);
    this.pos += headOffset + byteLength;
    return object;
  }
  decodeExtension(size, headOffset) {
    if (size > this.maxExtLength) {
      throw new DecodeError(`Max length exceeded: ext length (${size}) > maxExtLength (${this.maxExtLength})`);
    }
    const extType = this.view.getInt8(this.pos + headOffset);
    const data = this.decodeBinary(size, headOffset + 1);
    return this.extensionCodec.decode(data, extType, this.context);
  }
  lookU8() {
    return this.view.getUint8(this.pos);
  }
  lookU16() {
    return this.view.getUint16(this.pos);
  }
  lookU32() {
    return this.view.getUint32(this.pos);
  }
  readU8() {
    const value = this.view.getUint8(this.pos);
    this.pos++;
    return value;
  }
  readI8() {
    const value = this.view.getInt8(this.pos);
    this.pos++;
    return value;
  }
  readU16() {
    const value = this.view.getUint16(this.pos);
    this.pos += 2;
    return value;
  }
  readI16() {
    const value = this.view.getInt16(this.pos);
    this.pos += 2;
    return value;
  }
  readU32() {
    const value = this.view.getUint32(this.pos);
    this.pos += 4;
    return value;
  }
  readI32() {
    const value = this.view.getInt32(this.pos);
    this.pos += 4;
    return value;
  }
  readU64() {
    const value = getUint64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readI64() {
    const value = getInt64(this.view, this.pos);
    this.pos += 8;
    return value;
  }
  readU64AsBigInt() {
    const value = this.view.getBigUint64(this.pos);
    this.pos += 8;
    return value;
  }
  readI64AsBigInt() {
    const value = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return value;
  }
  readF32() {
    const value = this.view.getFloat32(this.pos);
    this.pos += 4;
    return value;
  }
  readF64() {
    const value = this.view.getFloat64(this.pos);
    this.pos += 8;
    return value;
  }
}

// node_modules/@msgpack/msgpack/dist.esm/decode.mjs
function decode(buffer, options) {
  const decoder = new Decoder(options);
  return decoder.decode(buffer);
}
// src/ts/network/bridge.ts
class Bridge {
  socket = null;
  protocol = "ndjson";
  SetSocket(socket) {
    this.socket = socket;
  }
  SetProtocol(protocol) {
    this.protocol = protocol;
  }
  Send(action) {
    if (!this.socket) {
      console.warn("[Bridge] Cannot send, socket not connected.");
      return;
    }
    try {
      if (this.protocol === "ndjson") {
        this.socket.write(JSON.stringify(action) + `
`);
      } else if (this.protocol === "length_prefixed_json") {
        const payload = Buffer.from(JSON.stringify(action));
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        this.socket.write(Buffer.concat([header, payload]));
      } else if (this.protocol === "length_prefixed_msgpack") {
        const msgpackData = encode(action);
        const payload = Buffer.from(msgpackData.buffer, msgpackData.byteOffset, msgpackData.byteLength);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(payload.length, 0);
        this.socket.write(Buffer.concat([header, payload]));
      }
    } catch (err) {
      console.error("[Bridge] Send serialization error:", err);
    }
  }
}

// src/ts/plugin-system/manager.ts
init_enums();
import { readdirSync, existsSync as existsSync4, mkdirSync as mkdirSync2, watch, statSync, readFileSync as readFileSync3 } from "fs";
import { EventEmitter } from "events";
import { resolve as resolve2, join as join4 } from "path";

// src/ts/plugin-system/context.ts
import { appendFileSync, existsSync as existsSync2, mkdirSync } from "fs";
import { resolve, join as join2 } from "path";

// src/ts/shared/translations.ts
import { readFileSync, existsSync } from "fs";
import { join } from "path";

class TranslationManager {
  translations = new Map;
  LoadLanguage(lang) {
    try {
      const path = join(process.cwd(), "translations", `${lang}.json`);
      if (existsSync(path)) {
        const content = readFileSync(path, "utf-8");
        this.translations.set(lang, JSON.parse(content));
      }
    } catch (e) {
      console.error(`[TranslationManager] Error loading language ${lang}:`, e);
    }
  }
  Format(text, ...args) {
    let formatted = text;
    for (let i = 0;i < args.length; i++) {
      formatted = formatted.replaceAll(`{${i}}`, String(args[i]));
    }
    return formatted;
  }
  LoadTranslations(filename) {
    this.LoadLanguage("en");
    this.LoadLanguage("tr");
  }
  GetTranslation(pluginName, key, lang) {
    return this.Translate(lang, key);
  }
  Translate(lang, key, ...args) {
    const langSet = this.translations.get(lang) || this.translations.get("en");
    if (!langSet || !langSet[key]) {
      return key;
    }
    return this.Format(langSet[key], ...args);
  }
}
var translationManager = new TranslationManager;

// src/ts/plugin-system/menu.ts
class Menu {
  bridge;
  title = "";
  subtitle = "";
  items = [];
  id;
  pagination = false;
  itemsPerPage = 5;
  lastClient = 0;
  lastPage = 1;
  constructor(bridge, title) {
    this.bridge = bridge;
    this.title = title;
    this.id = crypto.randomUUID();
  }
  GetId() {
    return this.id;
  }
  SetTitle(title) {
    this.title = title;
  }
  SetSubtitle(subtitle) {
    this.subtitle = subtitle;
  }
  SetPagination(enabled, itemsPerPage = 5) {
    this.pagination = enabled;
    this.itemsPerPage = itemsPerPage;
  }
  AddItem(info, display, disabled = false) {
    this.items.push({ info, display });
  }
  Display(client, page = 1) {
    this.lastClient = client;
    this.lastPage = page;
    let displayItems = [];
    let footer = "";
    let menuType = 0;
    if (this.pagination) {
      menuType = 2;
      const totalPages = Math.ceil(this.items.length / this.itemsPerPage);
      if (page < 1)
        page = 1;
      if (page > totalPages)
        page = totalPages;
      const start = (page - 1) * this.itemsPerPage;
      const slicedItems = this.items.slice(start, start + this.itemsPerPage);
      displayItems = [...slicedItems];
      while (displayItems.length < 6) {
        displayItems.push({ display: "---", info: "__none__" });
      }
      if (page > 1) {
        displayItems.push({ display: "<- Geri (Back)", info: "__back__" });
      } else {
        displayItems.push({ display: "---", info: "__none__" });
      }
      if (page < totalPages) {
        displayItems.push({ display: "\u0130leri (Next) ->", info: "__next__" });
      } else {
        displayItems.push({ display: "---", info: "__none__" });
      }
      displayItems.push({ display: "\xC7\u0131k\u0131\u015F (Exit)", info: "__exit__" });
      footer = `Sayfa ${page} / ${totalPages}`;
    } else {
      displayItems = this.items;
    }
    this.bridge.Send({
      action: "menu",
      client,
      menu_id: this.id,
      menu_title: this.title,
      menu_subtitle: this.subtitle,
      menu_footer: footer,
      menu_type: menuType.toString(),
      menu_items_json: JSON.stringify(displayItems)
    });
  }
  HandleInternalNavigation(client, info) {
    if (info === "__next__") {
      this.Display(client, this.lastPage + 1);
      return true;
    }
    if (info === "__back__") {
      this.Display(client, this.lastPage - 1);
      return true;
    }
    if (info === "__exit__") {
      return false;
    }
    return false;
  }
}

// src/ts/plugin-system/context.ts
init_context_store();
init_enums();
var COLOR_MAP = {
  "{Default}": "\x01",
  "{Red}": "\x02",
  "{LightRed}": "\x03",
  "{Green}": "\x04",
  "{Lime}": "\x05",
  "{LightGreen}": "\x06",
  "{DarkRed}": "\x07",
  "{Grey}": "\b",
  "{Yellow}": "\t",
  "{Gold}": `
`,
  "{Blue}": "\v",
  "{DarkBlue}": "\f",
  "{Purple}": "\x0E",
  "{Magenta}": "\x0F",
  "{Cyan}": "\x10"
};
function FormatColorTags(message) {
  let formatted = message;
  for (const [tag, code] of Object.entries(COLOR_MAP)) {
    formatted = formatted.replaceAll(tag, code);
  }
  return formatted;
}

class PluginContext {
  pluginName;
  pluginManager;
  bridge;
  players;
  adminManager;
  commandRegistry;
  listeners = [];
  timers = new Set;
  commands = new Set;
  menuCallbacks = new Map;
  preListeners = [];
  sdkHooks = [];
  registeredAPIs = new Set;
  constructor(pluginName, pluginManager, bridge, players, adminManager, commandRegistry) {
    this.pluginName = pluginName;
    this.pluginManager = pluginManager;
    this.bridge = bridge;
    this.players = players;
    this.adminManager = adminManager;
    this.commandRegistry = commandRegistry;
    const menuSelectHandler = (data) => {
      const anyData = data;
      const menu = this.menus.get(anyData.menuId);
      if (menu) {
        if (menu.HandleInternalNavigation(anyData.client, anyData.info)) {
          return;
        }
        const callback = this.menuCallbacks.get(anyData.menuId);
        if (callback) {
          pluginContextStore.run(this, () => callback(anyData.client, anyData.info));
        }
      }
    };
    this.listeners.push({ event: "MenuSelect", callback: menuSelectHandler });
    this.pluginManager.on("MenuSelect", menuSelectHandler);
  }
  HookEvent(event, callback) {
    const wrappedCallback = (data) => {
      pluginContextStore.run(this, () => callback(data));
    };
    this.listeners.push({ event, callback: wrappedCallback });
    this.pluginManager.on(event, wrappedCallback);
  }
  ServerCommand(cmd) {
    this.bridge.Send({ action: "command", cmd });
  }
  RegConsoleCmd(command, callback, flags, description) {
    const wrappedCallback = (client, args) => {
      pluginContextStore.run(this, () => callback(client, args));
    };
    this.commands.add(command);
    this.commandRegistry.RegConsoleCmd(command, wrappedCallback, flags, description);
  }
  menus = new Map;
  CreateMenu(title, callback) {
    const menu = new Menu(this.bridge, title);
    this.menus.set(menu.GetId(), menu);
    const wrappedCallback = (client, info) => {
      pluginContextStore.run(this, () => callback(client, info));
    };
    this.menuCallbacks.set(menu.GetId(), wrappedCallback);
    return menu;
  }
  LogMessage(message) {
    console.log(`[${this.pluginName}] ${message}`);
  }
  PrintToServerConsole(message) {
    this.pluginManager.PrintToServerConsole(message);
  }
  PrintHintText(client, message) {
    this.pluginManager.PrintHintText(client, message);
  }
  IsVoteInProgress() {
    return this.pluginManager.IsVoteInProgress();
  }
  CreateTimer(ms, callback, repeat) {
    let timer;
    const wrappedCallback = () => {
      const result = pluginContextStore.run(this, () => callback());
      if (result === Plugin_Stop || result === Plugin_Handled) {
        this.KillTimer(timer);
      }
    };
    timer = repeat ? setInterval(wrappedCallback, ms) : setTimeout(() => {
      this.timers.delete(timer);
      pluginContextStore.run(this, () => callback());
    }, ms);
    this.timers.add(timer);
    return timer;
  }
  KillTimer(timer) {
    clearTimeout(timer);
    clearInterval(timer);
    this.timers.delete(timer);
  }
  PrintToChat(client, message) {
    if (commandSourceStore.getStore() === "console") {
      this.PrintToConsole(client, message);
      return;
    }
    const formattedMessage = FormatColorTags(message);
    if (client === 0) {
      this.PrintToChatAll(formattedMessage);
      return;
    }
    const p = this.players.Get(client);
    if (p) {
      p.Say(formattedMessage);
    }
  }
  PrintToChatAll(message) {
    this.bridge.Send({ action: "say", text: FormatColorTags(message) });
  }
  PrintToConsole(client, message) {
    const formatted = FormatColorTags(message);
    if (client === 0) {
      this.LogMessage(formatted);
    } else {
      const escaped = formatted.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      this.bridge.Send({
        action: "client_command",
        client: String(client),
        cmd: `echo "${escaped}"`
      });
    }
  }
  ReplyToCommand(client, message) {
    const formattedMessage = FormatColorTags(message);
    if (commandSourceStore.getStore() === "console" || client === 0) {
      this.PrintToConsole(client, formattedMessage);
    } else {
      this.PrintToChat(client, formattedMessage);
    }
  }
  GetCmdReplySource() {
    return commandSourceStore.getStore() === "chat" ? 1 /* Chat */ : 0 /* Console */;
  }
  RegisterAPI(name, api) {
    this.pluginManager.RegisterAPI(name, api, this.pluginName);
    this.registeredAPIs.add(name);
  }
  HasAPI(name) {
    return this.pluginManager.HasAPI(name);
  }
  GetAPI(name) {
    return this.pluginManager.GetAPI(name);
  }
  GetAPIAsync(name) {
    return this.pluginManager.GetAPIAsync(name);
  }
  TPrintToChat(client, key, ...args) {
    const p = this.players.Get(client);
    const lang = p?.GetLanguage() ?? "en";
    const raw = translationManager.GetTranslation(this.pluginName, key, lang);
    const formatted = translationManager.Format(raw, ...args);
    this.PrintToChat(client, formatted);
  }
  LoadTranslations(filename) {
    translationManager.LoadTranslations(filename);
  }
  GetMaxClients() {
    return 32;
  }
  GetClientCount(inGameOnly = true) {
    return this.players.GetAll().length;
  }
  GetClientName(client) {
    return this.players.Get(client)?.name ?? "Unknown";
  }
  GetClientAuthId(client) {
    return this.players.Get(client)?.steamId ?? "ID_PENDING";
  }
  GetClientUserId(client) {
    return this.players.Get(client)?.userId ?? 0;
  }
  GetClientHealth(client) {
    return this.players.Get(client)?.GetHealth() ?? 0;
  }
  GetClientMoney(client) {
    return this.players.Get(client)?.GetMoney() ?? 0;
  }
  GetClientTeam(client) {
    return this.players.Get(client)?.GetTeam() ?? 0;
  }
  IsClientInGame(client) {
    return this.players.Get(client) !== undefined;
  }
  IsPlayerAlive(client) {
    return this.players.Get(client)?.IsAlive() ?? false;
  }
  SlapPlayer(client, damage) {
    this.players.Get(client)?.Slap(damage);
  }
  TeleportEntity(client, x, y, z) {
    this.players.Get(client)?.Teleport(x, y, z);
  }
  ChangeClientTeam(client, team) {
    this.players.Get(client)?.SetTeam(team);
  }
  RespawnPlayer(client) {
    this.players.Get(client)?.Respawn();
  }
  GivePlayerItem(client, item) {
    this.bridge.Send({ action: "give_item", client: client.toString(), item });
  }
  RemovePlayerItem(client, item) {
    this.bridge.Send({ action: "remove_item", client: client.toString(), item });
  }
  GetClientWeapon(client) {
    return this.players.Get(client)?.GetWeapon() ?? "";
  }
  SetWeaponAmmo(client, weapon, ammo) {
    this.bridge.Send({ action: "set_ammo", client: client.toString(), weapon, ammo: ammo.toString() });
  }
  SetEntityGravity(client, gravity) {
    this.players.Get(client)?.SetGravity(gravity);
  }
  SetEntityMoveType(client, movetype) {
    this.players.Get(client)?.SetMoveType(movetype);
  }
  SetEntityHealth(client, health) {
    this.players.Get(client)?.SetHealth(health);
  }
  SetEntityModel(client, model) {
    this.players.Get(client)?.SetModel(model);
  }
  SetEntityRenderColor(client, r, g, b, a) {
    this.players.Get(client)?.SetRenderColor(r, g, b, a);
  }
  EmitSoundToClient(client, soundPath, volume, channel, pitch) {
    this.players.Get(client)?.EmitSound(soundPath, volume, channel, pitch);
  }
  EmitSoundToAll(soundPath, volume, channel, pitch) {
    const payload = { action: "play_sound", sound: soundPath, all: "true" };
    if (volume !== undefined)
      payload.volume = volume.toString();
    if (channel !== undefined)
      payload.channel = channel.toString();
    if (pitch !== undefined)
      payload.pitch = pitch.toString();
    this.bridge.Send(payload);
  }
  KickClient(client, reason) {
    this.players.Get(client)?.Kick(reason);
  }
  BanClient(steamId, reason, adminSteamId, duration, ip = "") {
    this.bridge.Send({ action: "ban", steamid: steamId, duration: duration.toString(), reason, admin: adminSteamId, ip });
  }
  RemoveBan(steamId) {
    this.bridge.Send({ action: "unban", steamid: steamId });
  }
  CheckCommandAccess(client, command, flags) {
    const player = this.players.Get(client);
    if (!player)
      return false;
    return this.adminManager.HasPermission(player.steamId, flags);
  }
  GetUserFlagBits(client) {
    const player = this.players.Get(client);
    if (!player)
      return "";
    return this.adminManager.GetFlags(player.steamId);
  }
  CreateVote(question, options, callback, durationMs = 1e4) {
    if (this.pluginManager.IsVoteInProgress()) {
      console.warn("[Plugin Context] A vote is already in progress. Cannot start another.");
      return;
    }
    const results = {};
    for (const opt of options) {
      results[opt] = 0;
    }
    const players = this.players.GetInGameClients();
    if (players.length === 0) {
      callback(results);
      return;
    }
    const menu = this.CreateMenu(question, (client, info) => {
      if (results[info] !== undefined) {
        results[info]++;
      }
    });
    for (const opt of options) {
      menu.AddItem(opt, opt);
    }
    for (const p of players) {
      menu.Display(p.index);
    }
    setTimeout(() => {
      callback(results);
    }, durationMs);
  }
  CancelVote() {
    return this.pluginManager.CancelVote();
  }
  GetClientIP(client) {
    return this.players.Get(client)?.GetIPAddress() ?? "127.0.0.1";
  }
  GetClientCountry(client) {
    return this.players.Get(client)?.GetCountry() ?? "Local / Unknown";
  }
  LogToFile(filename, message) {
    try {
      const logsDir = resolve(process.cwd(), "logs");
      if (!existsSync2(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = join2(logsDir, filename);
      const timestamp = new Date().toISOString();
      appendFileSync(logFilePath, `[${timestamp}] [${this.pluginName}] ${message}
`);
    } catch (e) {
      console.error("[LogToFile] Error writing log:", e);
    }
  }
  GetCurrentMap() {
    return this.pluginManager.GetCurrentMap();
  }
  GetEngineTime() {
    return this.pluginManager.GetEngineTime();
  }
  GetTickrate() {
    return 128;
  }
  GetTickInterval() {
    return 1 / 128;
  }
  GetBridgeLatency() {
    return this.pluginManager.GetBridgeLatency();
  }
  GetState(key, initialValue) {
    return this.pluginManager.GetPluginState(this.pluginName, key, initialValue);
  }
  SetState(key, value) {
    this.pluginManager.SetPluginState(this.pluginName, key, value);
  }
  CreateConVar(name, defaultValue, description) {
    return this.pluginManager.CreateConVar(name, defaultValue, description);
  }
  FindConVar(name) {
    return this.pluginManager.FindConVar(name);
  }
  RegClientCookie(name, description) {
    return this.pluginManager.RegClientCookie(name, description);
  }
  FindClientCookie(name) {
    return this.pluginManager.FindClientCookie(name);
  }
  async SQL_TQuery(sql, args = []) {
    return this.pluginManager.SQL_TQuery(sql, args);
  }
  async Discord_SendMessage(channelId, content) {
    return this.pluginManager.Discord_SendMessage(channelId, content);
  }
  HookEventPre(event, callback) {
    const wrappedCallback = (data) => {
      return pluginContextStore.run(this, () => callback(data));
    };
    this.preListeners.push({ event, callback: wrappedCallback });
    this.pluginManager.HookEventPre(event, wrappedCallback);
  }
  SDKHook(client, hookType, callback) {
    const wrappedCallback = (...args) => {
      return pluginContextStore.run(this, () => callback(...args));
    };
    this.sdkHooks.push({ client, hookType, callback: wrappedCallback });
    this.pluginManager.SDKHook(client, hookType, wrappedCallback);
  }
  SDKUnhook(client, hookType, callback) {
    const idx = this.sdkHooks.findIndex((h) => h.client === client && h.hookType === hookType);
    if (idx !== -1) {
      const entry = this.sdkHooks[idx];
      this.sdkHooks.splice(idx, 1);
      this.pluginManager.SDKUnhook(client, hookType, entry.callback);
    }
  }
  GetClientClanTag(client) {
    const p = this.players.Get(client);
    return p ? p.GetClanTag() : "";
  }
  SetClientClanTag(client, tag) {
    const p = this.players.Get(client);
    if (p)
      p.SetClanTag(tag);
  }
  IsClientForcedObserver(client) {
    const p = this.players.Get(client);
    return p ? p.IsForcedObserver() : false;
  }
  SetClientForcedObserver(client, forced) {
    const p = this.players.Get(client);
    if (p)
      p.SetForcedObserver(forced);
  }
  ClientCommand(client, cmd) {
    this.bridge.Send({ action: "client_command", client: client.toString(), cmd });
  }
  Cleanup() {
    console.log(`[Plugin Context] Cleaning up resources for: ${this.pluginName}`);
    for (const { event, callback } of this.listeners) {
      this.pluginManager.removeListener(event, callback);
    }
    this.listeners = [];
    for (const { event, callback } of this.preListeners) {
      this.pluginManager.UnhookEventPre(event, callback);
    }
    this.preListeners = [];
    for (const { client, hookType, callback } of this.sdkHooks) {
      this.pluginManager.SDKUnhook(client, hookType, callback);
    }
    this.sdkHooks = [];
    for (const timer of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
    for (const command of this.commands) {
      this.commandRegistry.UnregConsoleCmd(command);
    }
    this.commands.clear();
    this.menuCallbacks.clear();
    for (const name of this.registeredAPIs) {
      this.pluginManager.UnregisterAPI(name);
    }
    this.registeredAPIs.clear();
  }
}

// src/ts/plugin-system/manager.ts
init_context_store();

// src/ts/plugin-system/convar.ts
class ConVar {
  name;
  value;
  description;
  onValueChange;
  changeHooks = [];
  constructor(name, value, description = "", onValueChange) {
    this.name = name;
    this.value = value;
    this.description = description;
    this.onValueChange = onValueChange;
  }
  GetName() {
    return this.name;
  }
  GetFloat() {
    return parseFloat(this.value) || 0;
  }
  GetInt() {
    return parseInt(this.value) || 0;
  }
  GetString() {
    return this.value;
  }
  SetFloat(value) {
    this.SetValue(value.toString());
  }
  SetInt(value) {
    this.SetValue(value.toString());
  }
  SetString(value) {
    this.SetValue(value);
  }
  AddChangeHook(callback) {
    this.changeHooks.push(callback);
  }
  UpdateValueFromBridge(newValue) {
    const oldValue = this.value;
    if (oldValue === newValue)
      return;
    this.value = newValue;
    for (const hook of this.changeHooks) {
      try {
        hook(this, oldValue, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in change hook for ${this.name}:`, e);
      }
    }
  }
  SetValue(newValue) {
    const oldValue = this.value;
    if (oldValue === newValue)
      return;
    this.value = newValue;
    if (this.onValueChange) {
      try {
        this.onValueChange(this.name, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in onValueChange callback for ${this.name}:`, e);
      }
    }
    for (const hook of this.changeHooks) {
      try {
        hook(this, oldValue, newValue);
      } catch (e) {
        console.error(`[ConVar] Error in change hook for ${this.name}:`, e);
      }
    }
  }
}

// src/ts/plugin-system/cookie.ts
class ClientCookie {
  name;
  description;
  db;
  constructor(name, description, db) {
    this.name = name;
    this.description = description;
    this.db = db;
  }
  GetName() {
    return this.name;
  }
  Get(client) {
    const steamId = this.GetSteamId(client);
    if (!steamId)
      return "";
    return this.db.GetCookie(steamId, this.name);
  }
  Set(client, value) {
    const steamId = this.GetSteamId(client);
    if (!steamId)
      return;
    this.db.SetCookie(steamId, this.name, value);
  }
  GetSteamId(client) {
    try {
      const { players: players2 } = (init_core(), __toCommonJS(exports_core));
      const p = players2.Get(client);
      return p ? p.steamId : null;
    } catch {
      return null;
    }
  }
}

// src/ts/shared/discord.ts
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "fs";
import { join as join3 } from "path";

class DiscordService {
  token = "";
  permissions = {};
  constructor() {
    this.LoadConfig();
  }
  LoadConfig() {
    try {
      const settingsPath = join3(process.cwd(), "configs", "core", "settings.json");
      if (existsSync3(settingsPath)) {
        const settings = JSON.parse(readFileSync2(settingsPath, "utf-8"));
        this.token = settings.discord?.token || "";
      }
      const permPath = join3(process.cwd(), "configs", "core", "discord_permissions.json");
      if (existsSync3(permPath)) {
        const permData = JSON.parse(readFileSync2(permPath, "utf-8"));
        this.permissions = permData.plugins || {};
      }
    } catch (err) {
      console.error("[DiscordService] Error loading configuration:", err);
    }
  }
  Reload() {
    this.LoadConfig();
  }
  HasPermission(pluginName, action, channelId) {
    const perms = this.permissions[pluginName];
    if (!perms)
      return false;
    if (action === "can_send_messages") {
      if (!perms.can_send_messages)
        return false;
      if (channelId && perms.allowed_channels && perms.allowed_channels.length > 0) {
        return perms.allowed_channels.includes(channelId);
      }
      return true;
    }
    return !!perms[action];
  }
  async SendMessage(pluginName, channelId, content) {
    if (!this.token) {
      console.error(`[DiscordService] Cannot send message: No bot token configured.`);
      return false;
    }
    if (!this.HasPermission(pluginName, "can_send_messages", channelId)) {
      console.warn(`[DiscordService] Permission denied for plugin '${pluginName}' to send message to channel ${channelId}.`);
      return false;
    }
    try {
      const body = typeof content === "string" ? { content } : { embeds: [content] };
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${this.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errData = await response.json();
        console.error(`[DiscordService] Discord API Error:`, errData);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[DiscordService] Request failed:`, err);
      return false;
    }
  }
}
var discordService = new DiscordService;

// src/ts/plugin-system/manager.ts
var COLOR_MAP2 = {
  "{Default}": "\x01",
  "{White}": "\x01",
  "{Red}": "\x02",
  "{LightRed}": "\x03",
  "{Green}": "\x04",
  "{Lime}": "\x05",
  "{LightGreen}": "\x06",
  "{DarkRed}": "\x07",
  "{Grey}": "\b",
  "{Yellow}": "\t",
  "{Gold}": `
`,
  "{Blue}": "\v",
  "{DarkBlue}": "\f",
  "{Purple}": "\x0E",
  "{Magenta}": "\x0F",
  "{Orange}": "\x10",
  "{Cyan}": "\x10"
};
var ANSI_COLOR_MAP = {
  "\x01": "\x1B[0m",
  "\x02": "\x1B[31m",
  "\x03": "\x1B[91m",
  "\x04": "\x1B[32m",
  "\x05": "\x1B[92m",
  "\x06": "\x1B[92m",
  "\x07": "\x1B[31m",
  "\b": "\x1B[90m",
  "\t": "\x1B[93m",
  "\n": "\x1B[33m",
  "\v": "\x1B[34m",
  "\f": "\x1B[94m",
  "\x0E": "\x1B[35m",
  "\x0F": "\x1B[95m",
  "\x10": "\x1B[38;5;208m"
};
function FormatColorTags2(message) {
  let formatted = message;
  for (const [tag, code] of Object.entries(COLOR_MAP2)) {
    formatted = formatted.replaceAll(tag, code);
  }
  return formatted;
}
function ToAnsi(message) {
  let formatted = message;
  for (const [code, ansi] of Object.entries(ANSI_COLOR_MAP)) {
    formatted = formatted.replaceAll(code, ansi);
  }
  return formatted + "\x1B[0m";
}

class PluginManager extends EventEmitter {
  bridge;
  players;
  adminManager;
  enableWatcher;
  getEngineTime;
  pluginsFolder = resolve2(process.cwd(), "plugins");
  loadedPlugins = new Map;
  commands = new Map;
  watcher = null;
  activeVote = false;
  activeVoteTimer = null;
  convars = new Map;
  bridgeLatency = 5;
  cookies = new Map;
  preListeners = new Map;
  sdkHooks = new Map;
  playerCommandTimestamps = new Map;
  commandAliases = new Map;
  sharedAPIs = new Map;
  pendingAPIPromises = new Map;
  consoleFilters = [];
  currentMap = "";
  PrintToServerConsole(message) {
    console.log(message);
    this.bridge.Send({
      action: "print",
      message
    });
  }
  constructor(bridge, players2, adminManager, enableWatcher = true, getEngineTime) {
    super();
    this.bridge = bridge;
    this.players = players2;
    this.adminManager = adminManager;
    this.enableWatcher = enableWatcher;
    this.getEngineTime = getEngineTime;
    this.on("newListener", (event) => {
      if (event === "newListener" || event === "removeListener")
        return;
      const eventStr = String(event);
      const count = this.listenerCount(eventStr);
      if (count === 0) {
        console.log(`[Plugin Manager] Dynamically hooking event in Metamod: ${eventStr}`);
        this.bridge.Send({ action: "hook_event", event: eventStr });
      }
    });
    this.on("removeListener", (event) => {
      if (event === "newListener" || event === "removeListener")
        return;
      const eventStr = String(event);
      setTimeout(() => {
        const count = this.listenerCount(eventStr);
        if (count === 0) {
          console.log(`[Plugin Manager] Dynamically unhooking event in Metamod: ${eventStr}`);
          this.bridge.Send({ action: "unhook_event", event: eventStr });
        }
      }, 0);
    });
    this.on("ConVarChanged", (data) => {
      if (data && data.name && data.value !== undefined) {
        const cvar = this.convars.get(String(data.name));
        if (cvar) {
          cvar.UpdateValueFromBridge(String(data.value));
        }
      }
    });
    if (this.enableWatcher) {
      this.SetupWatcher();
    }
    this.SetupCommandInterceptor();
    this.on("MapStart", (data) => {
      const mapData = data;
      this.currentMap = mapData.map || "";
      for (const entry of this.loadedPlugins.values()) {
        const plugin = entry.plugin;
        if (typeof plugin.OnMapStart === "function") {
          plugin.OnMapStart(data);
        }
      }
    });
    this.on("MapEnd", (data) => {
      this.currentMap = "";
      for (const entry of this.loadedPlugins.values()) {
        const plugin = entry.plugin;
        if (typeof plugin.OnMapEnd === "function") {
          plugin.OnMapEnd(data);
        }
      }
    });
    this.RegConsoleCmd("meta-bun", (client, args) => {
      if (!args || args.length === 0) {
        this.ReplyToCommand(client, "{Green}[Meta-Bun]{Default} Kullan\u0131m: !meta-bun <list | load | unload | reload> [eklenti]");
        return;
      }
      this.HandleMetaBunCommand(client, args).catch((err) => {
        console.error("[Plugin Manager] Error in meta-bun command:", err);
      });
    }, "z", "Meta-Bun eklenti yonetim sistemi");
    this.RegConsoleCmd("sm_help", (client, args) => {
      this.HandleHelpCommand(client, args);
    }, null, "Yardim komutu - komut listesini gosterir");
    this.RegConsoleCmdAlias("help", "sm_help");
    this.RegConsoleCmd("sm_plugins", (client, args) => {
      this.HandlePluginsCommand(client, args);
    }, "z", "Meta-Bun eklentillerini listeler");
    this.RegConsoleCmd("sm_reloadadmins", (client, args) => {
      this.adminManager.ReloadAdmins();
      this.ReplyToCommand(client, "{Green}[Meta-Bun]{Default} Admin listesi ve yetkiler yeniden yuklendi.");
    }, "z", "Admin listesini yeniden yukler");
    this.RegConsoleCmd("sm_who", (client, args) => {
      this.HandleWhoCommand(client, args);
    }, "b", "Oyundaki oyuncularin yetki durumlarini gosterir");
    this.RegConsoleCmd("sm_admins", (client, args) => {
      this.HandleAdminsCommand(client, args);
    }, "z", "Sunucuda tanimli tum adminleri listeler");
    this.RegConsoleCmd("sm_fsay", (client, args) => {
      this.HandleFsayCommand(client, args);
    }, "z", "Hedef oyuncu adina mesaj gonderir (Fake Say)");
    setInterval(() => this.SweepExpiredBans(), 5 * 60 * 1000);
    this.on("BridgeConnected", () => {
      console.log("[Plugin Manager] Bridge connected. Synchronizing commands, convars, and hooks...");
      for (const [command, entry] of this.commands.entries()) {
        this.bridge.Send({
          action: "register_command",
          name: command,
          description: entry.description || ""
        });
      }
      for (const [name, cvar] of this.convars.entries()) {
        this.bridge.Send({
          action: "cvar_register",
          name,
          defaultValue: cvar.GetString(),
          description: cvar.description
        });
      }
      for (const event of this.eventNames()) {
        const eventStr = String(event);
        if (eventStr !== "newListener" && eventStr !== "removeListener" && eventStr !== "BridgeConnected") {
          console.log(`[Plugin Manager] Re-hooking event: ${eventStr}`);
          this.bridge.Send({ action: "hook_event", event: eventStr });
        }
      }
      for (const [client, clientHooks] of this.sdkHooks.entries()) {
        for (const typeKey of clientHooks.keys()) {
          const hookType = typeKey;
          console.log(`[Plugin Manager] Re-hooking SDK callback for client ${client}: type ${hookType}`);
          this.bridge.Send({ action: "hook_sdk", client, type: hookType });
        }
      }
    });
  }
  async HandleMetaBunCommand(client, args) {
    if (!args || args.length === 0 || args[0]?.toLowerCase() === "help") {
      this.ReplyToCommand(client, "{Green}[Meta-Bun]{Default} Kullan\u0131m: !meta-bun <list | load | unload | reload> [eklenti]");
      return;
    }
    const subcommand = args[0]?.toLowerCase() || "";
    if (subcommand === "list") {
      if (!existsSync4(this.pluginsFolder)) {
        this.ReplyToCommand(client, "{Green}[Meta-Bun]{Default} Eklenti klas\xF6r\xFC bulunamad\u0131.");
        return;
      }
      const items = readdirSync(this.pluginsFolder, { withFileTypes: true });
      const list = [];
      for (const item of items) {
        const filename = item.name;
        if (item.isFile()) {
          if ((filename.endsWith(".ts") || filename.endsWith(".js")) && !filename.endsWith(".d.ts")) {
            const loaded = this.loadedPlugins.get(filename);
            if (loaded) {
              list.push(`{Green}[Loaded]{Default} ${loaded.plugin.name} v${loaded.plugin.version || "1.0.0"} - ${loaded.plugin.author || "Unknown"} (${filename})`);
            } else {
              list.push(`{Red}[Off]{Default} ${filename}`);
            }
          }
        } else if (item.isDirectory()) {
          const loaded = this.loadedPlugins.get(filename);
          if (loaded) {
            list.push(`{Green}[Loaded]{Default} ${loaded.plugin.name} v${loaded.plugin.version || "1.0.0"} - ${loaded.plugin.author || "Unknown"} (klas\xF6r: ${filename})`);
          } else {
            list.push(`{Red}[Off]{Default} (klas\xF6r: ${filename})`);
          }
        }
      }
      this.ReplyToCommand(client, `{Gold}=== Meta-Bun Eklentileri (${list.length}) ==={Default}`);
      for (const line of list) {
        this.ReplyToCommand(client, line);
      }
      return;
    }
    if (args.length < 2) {
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Kullan\u0131m: !meta-bun ${subcommand} <eklenti_dosyasi_veya_klasoru>`);
      return;
    }
    const targetName = args[1] || "";
    let resolvedName = null;
    if (targetName && existsSync4(resolve2(this.pluginsFolder, targetName))) {
      resolvedName = targetName;
    } else if (targetName) {
      const items = readdirSync(this.pluginsFolder);
      for (const item of items) {
        if (item === targetName + ".ts" || item === targetName + ".js" || item.toLowerCase() === targetName.toLowerCase()) {
          resolvedName = item;
          break;
        }
      }
    }
    if (!resolvedName) {
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti bulunamad\u0131: ${targetName}`);
      return;
    }
    if (subcommand === "load") {
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti y\xFCkleniyor: ${resolvedName}...`);
      await this.LoadPlugin(resolvedName);
      if (this.loadedPlugins.has(resolvedName)) {
        const loaded = this.loadedPlugins.get(resolvedName);
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti ba\u015Far\u0131yla y\xFCklendi: {LightBlue}${loaded.plugin.name}{Default} (${loaded.plugin.version})`);
      } else {
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti y\xFCklenemedi. Detaylar konsolda.`);
      }
      return;
    }
    if (subcommand === "unload") {
      if (!this.loadedPlugins.has(resolvedName)) {
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti zaten y\xFCkl\xFC de\u011Fil: ${resolvedName}`);
        return;
      }
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti kald\u0131r\u0131l\u0131yor: ${resolvedName}...`);
      await this.UnloadPlugin(resolvedName);
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti ba\u015Far\u0131yla kald\u0131r\u0131ld\u0131.`);
      return;
    }
    if (subcommand === "reload") {
      if (!this.loadedPlugins.has(resolvedName)) {
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Red} Hata:{Default} Yeniden y\xFCklenecek eklenti bulunamad\u0131 veya y\xFCkl\xFC de\u011Fil: ${resolvedName}`);
        return;
      }
      this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti yeniden y\xFCkleniyor: ${resolvedName}...`);
      await this.LoadPlugin(resolvedName);
      if (this.loadedPlugins.has(resolvedName)) {
        const loaded = this.loadedPlugins.get(resolvedName);
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Default} Eklenti ba\u015Far\u0131yla yeniden y\xFCklendi: {LightBlue}${loaded.plugin.name}{Default} (${loaded.plugin.version})`);
      } else {
        this.ReplyToCommand(client, `{Green}[Meta-Bun]{Red} Hata:{Default} Eklenti yeniden y\xFCklenirken hata olu\u015Ftu.`);
      }
      return;
    }
  }
  HandleHelpCommand(client, args) {
    const commandNames = Array.from(this.commands.keys()).sort();
    const totalCommands = commandNames.length;
    const pageSize = 10;
    const totalPages = Math.ceil(totalCommands / pageSize) || 1;
    let page = 1;
    if (args && args.length > 0 && args[0]) {
      const parsed = parseInt(args[0], 10);
      if (!isNaN(parsed) && parsed > 0) {
        page = parsed;
      }
    }
    if (page > totalPages) {
      page = totalPages;
    }
    this.ReplyToCommand(client, `{Gold}=== Yard\u0131m (Sayfa ${page}/${totalPages}) ==={Default}`);
    const startIdx = (page - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalCommands);
    const pageCommands = commandNames.slice(startIdx, endIdx);
    for (const cmdName of pageCommands) {
      const entry = this.commands.get(cmdName);
      const desc = entry?.description ? ` - ${entry.description}` : "";
      this.ReplyToCommand(client, `{Green}${cmdName}{Default}${desc}`);
    }
  }
  HandlePluginsCommand(client, args) {
    this.ReplyToCommand(client, `{Gold}=== Meta-Bun Eklentileri (${this.loadedPlugins.size}) ==={Default}`);
    let index = 1;
    for (const [filename, entry] of this.loadedPlugins.entries()) {
      const p = entry.plugin;
      const author = p.author ? ` by ${p.author}` : "";
      const version = p.version ? ` (${p.version})` : "";
      this.ReplyToCommand(client, `{Green}[${index.toString().padStart(2, "0")}]{Default} "${p.name}"${version}${author} - ${filename}`);
      index++;
    }
  }
  HandleWhoCommand(client, args) {
    const players2 = this.players.GetAll();
    this.ReplyToCommand(client, `{Gold}=== Aktif Oyuncular ve Yetkiler (${players2.length}) ==={Default}`);
    for (const p of players2) {
      const flags = this.adminManager.GetFlags(p.steamId) || "Yetki Yok";
      const immunity = this.adminManager.GetImmunity(p.steamId);
      this.ReplyToCommand(client, `{Green}${p.name}{Default} (ID: ${p.index}) - Flags: {Yellow}${flags}{Default} (Immunity: ${immunity})`);
    }
  }
  HandleAdminsCommand(client, args) {
    const configPath = join4(process.cwd(), "configs", "admins", "list.json");
    if (!existsSync4(configPath)) {
      this.ReplyToCommand(client, "{Red}[Hata]{Default} Admin listesi dosyasi bulunamadi.");
      return;
    }
    try {
      const content = readFileSync3(configPath, "utf-8");
      const admins = JSON.parse(content);
      this.ReplyToCommand(client, `{Gold}=== Tanimli Admin Listesi ==={Default}`);
      for (const [id, entry] of Object.entries(admins)) {
        let flags = "";
        let groups = "";
        if (typeof entry === "string") {
          flags = entry;
        } else {
          flags = entry.flags || "";
          groups = entry.groups ? ` (Grup: ${entry.groups.join(", ")})` : "";
        }
        this.ReplyToCommand(client, `{Green}${id}{Default} - Flags: {Yellow}${flags}{Default}${groups}`);
      }
    } catch (err) {
      this.ReplyToCommand(client, "{Red}[Hata]{Default} Admin listesi okunurken bir hata olustu.");
    }
  }
  HandleFsayCommand(client, args) {
    if (args.length < 2) {
      this.ReplyToCommand(client, "{Yellow}Kullanim: {Default}sm_fsay <target> <mesaj>");
      return;
    }
    const targetPattern = args[0];
    const message = args.slice(1).join(" ");
    const players2 = this.players.GetAll();
    const target = players2.find((p) => p.index.toString() === targetPattern || p.name.toLowerCase().includes(targetPattern.toLowerCase()));
    if (!target) {
      this.ReplyToCommand(client, `{Red}[Hata]{Default} '${targetPattern}' desenine uygun oyuncu bulunamad\u0131.`);
      return;
    }
    this.PrintToChatAll(`{Default}${target.name}: ${message}`);
    this.LogMessage(`[FSAY] ${target.name} (ad\u0131na ${client} taraf\u0131ndan): ${message}`);
  }
  SweepExpiredBans() {
    const pm = this.players;
    if (pm && pm.db) {
      try {
        const bans = pm.db.GetAllBans();
        const now = Date.now();
        let sweptCount = 0;
        for (const ban of bans) {
          if (ban.duration === 0)
            continue;
          const expiry = ban.timestamp + ban.duration * 60 * 1000;
          if (expiry <= now) {
            pm.db.RemoveBan(ban.steamid);
            sweptCount++;
          }
        }
        if (sweptCount > 0) {
          console.log(`[Plugin Manager] Expired ban sweeper: Swept and removed ${sweptCount} expired ban records.`);
        }
      } catch (error) {
        console.error("[Plugin Manager] Error during ban sweeper run:", error);
      }
    }
  }
  SetupCommandInterceptor() {
    this.HookEventPre("PlayerChat", (data) => {
      const chatData = data;
      const player2 = this.players.Get(chatData.client);
      if (player2 && player2.IsGagged()) {
        player2.Say("You cannot send messages while your chat is gagged.");
        return 3;
      }
      const text = chatData.text.trim();
      if (player2 && !text.startsWith("!") && !text.startsWith("/")) {
        try {
          const chatColorsPath = resolve2(process.cwd(), "configs", "admins", "chat_colors.json");
          if (existsSync4(chatColorsPath)) {
            const config = JSON.parse(readFileSync3(chatColorsPath, "utf-8"));
            let roleConfig = null;
            if (config.players && config.players[player2.steamId]) {
              roleConfig = config.players[player2.steamId];
            } else if (config.groups) {
              const playerGroups = this.adminManager.GetGroups(player2.steamId);
              for (const groupName of playerGroups) {
                if (config.groups[groupName]) {
                  roleConfig = config.groups[groupName];
                  break;
                }
              }
            }
            if (roleConfig) {
              const tag = roleConfig.tag_text ? `${roleConfig.tag_color || "{Default}"}${roleConfig.tag_text} ` : "";
              const nameColor = roleConfig.name_color || "{Default}";
              const chatColor = roleConfig.chat_color || "{Default}";
              const formattedMessage = `${tag}${nameColor}${player2.name}{Default}: ${chatColor}${text}`;
              this.PrintToChatAll(formattedMessage);
              return 3;
            }
          }
        } catch (err) {
          console.error("[Plugin Manager] Error processing admin chat colors:", err);
        }
      }
      if (text.startsWith("!") || text.startsWith("/")) {
        const parts = text.split(/\s+/);
        const commandWithTrigger = parts[0];
        if (commandWithTrigger) {
          let commandName = commandWithTrigger.substring(1);
          const args = parts.slice(1);
          if (this.commandAliases.has(commandName)) {
            commandName = this.commandAliases.get(commandName);
          }
          const smCommandName = `sm_${commandName}`;
          let cmdEntry = this.commands.get(smCommandName);
          if (!cmdEntry) {
            cmdEntry = this.commands.get(commandName);
          }
          if (!cmdEntry) {
            cmdEntry = this.commands.get(commandWithTrigger);
          }
          if (cmdEntry) {
            const now = Date.now();
            const lastCalled = this.playerCommandTimestamps.get(chatData.client) || 0;
            if (chatData.client !== 0 && now - lastCalled < 1000) {
              if (player2) {
                player2.Say("Please do not spam commands.");
              }
              return 3;
            }
            this.playerCommandTimestamps.set(chatData.client, now);
            const cheatCommands = ["noclip", "god", "give", "sm_noclip", "sm_god", "sm_give"];
            const isCheat = cheatCommands.includes(commandName) || cheatCommands.includes(smCommandName);
            if (isCheat) {
              const svCheats = this.FindConVar("sv_cheats");
              const cheatsEnabled = svCheats ? svCheats.GetInt() === 1 : false;
              if (!cheatsEnabled) {
                if (player2) {
                  player2.Say("This command requires sv_cheats to be enabled.");
                }
                return 3;
              }
            }
            const { callback, flags } = cmdEntry;
            let flagsToCheck = flags;
            const overrideFlags = this.adminManager.GetCommandOverride(smCommandName) ?? this.adminManager.GetCommandOverride(commandName);
            if (overrideFlags !== undefined) {
              flagsToCheck = overrideFlags || null;
            }
            if (chatData.client !== 0 && flagsToCheck) {
              const hasAccess = this.CheckCommandAccess(chatData.client, commandName, flagsToCheck);
              if (!hasAccess) {
                const player3 = this.players.Get(chatData.client);
                if (player3) {
                  player3.Say("Yetkiniz yok");
                } else {
                  this.PrintToChat(chatData.client, "Yetkiniz yok");
                }
                return 3;
              }
            }
            commandSourceStore.run("chat", () => {
              try {
                const res = callback(chatData.client, args);
                if (res instanceof Promise) {
                  res.catch((err) => {
                    console.error(`[Plugin Manager] Uncaught exception in async chat command "${commandName}":`, err);
                  });
                }
              } catch (err) {
                console.error(`[Plugin Manager] Uncaught exception in chat command "${commandName}":`, err);
              }
            });
            return 3;
          }
        }
      }
      return 0;
    });
    this.HookEvent("ConsoleCommand", (data) => {
      const cmdData = data;
      const commandName = cmdData.command;
      const args = cmdData.args || [];
      let resolvedCmd = commandName;
      if (this.commandAliases.has(resolvedCmd)) {
        resolvedCmd = this.commandAliases.get(resolvedCmd);
      }
      const smCommandName = resolvedCmd.startsWith("sm_") ? resolvedCmd : `sm_${resolvedCmd}`;
      let cmdEntry = this.commands.get(smCommandName);
      if (!cmdEntry) {
        cmdEntry = this.commands.get(resolvedCmd);
      }
      if (cmdEntry) {
        const { callback, flags } = cmdEntry;
        let flagsToCheck = flags;
        const overrideFlags = this.adminManager.GetCommandOverride(smCommandName) ?? this.adminManager.GetCommandOverride(resolvedCmd);
        if (overrideFlags !== undefined) {
          flagsToCheck = overrideFlags || null;
        }
        if (cmdData.client !== 0 && flagsToCheck) {
          const hasAccess = this.CheckCommandAccess(cmdData.client, resolvedCmd, flagsToCheck);
          if (!hasAccess) {
            commandSourceStore.run("console", () => {
              this.ReplyToCommand(cmdData.client, "Yetkiniz yok");
            });
            return;
          }
        }
        commandSourceStore.run("console", () => {
          try {
            const res = callback(cmdData.client, args);
            if (res instanceof Promise) {
              res.catch((err) => {
                console.error(`[Plugin Manager] Uncaught exception in async console command "${resolvedCmd}":`, err);
              });
            }
          } catch (err) {
            console.error(`[Plugin Manager] Uncaught exception in console command "${resolvedCmd}":`, err);
          }
        });
      }
    });
  }
  HookEvent(event, callback) {
    this.on(event, callback);
  }
  ServerCommand(cmd) {
    this.bridge.Send({ action: "command", cmd });
  }
  RegConsoleCmd(command, callback, flags, description) {
    this.commands.set(command, { callback, flags, description });
    console.log(`[Plugin Manager] Registered command: ${command}${flags ? ` [Flags: ${flags}]` : ""}${description ? ` (${description})` : ""}`);
    this.bridge.Send({
      action: "register_command",
      name: command,
      description: description || ""
    });
  }
  RegConsoleCmdAlias(alias, command) {
    this.commandAliases.set(alias, command);
  }
  AddConsoleFilter(filter) {
    this.consoleFilters.push(filter);
  }
  LogMessage(message) {
    let msg = message;
    for (const filter of this.consoleFilters) {
      msg = filter(msg);
      if (msg === null)
        return;
    }
    const prefix = "{Red}[Meta-Bun] {Default}";
    const fullMessage = msg.startsWith("[") ? msg : `${prefix}${msg}`;
    const ansiFormatted = ToAnsi(fullMessage);
    console.log(ansiFormatted);
  }
  CreateTimer(ms, callback, repeat) {
    return repeat ? setInterval(callback, ms) : setTimeout(callback, ms);
  }
  KillTimer(timer) {
    clearTimeout(timer);
    clearInterval(timer);
  }
  PrintToChat(client, message) {
    if (commandSourceStore.getStore() === "console") {
      this.PrintToConsole(client, message);
      return;
    }
    let msg = message;
    for (const filter of this.consoleFilters) {
      msg = filter(msg);
      if (msg === null)
        return;
    }
    const formatted = FormatColorTags2(msg);
    this.LogMessage(`[Chat -> ${client}] ${msg}`);
    this.bridge.Send({ action: "say", text: formatted });
  }
  PrintToChatAll(message) {
    let msg = message;
    for (const filter of this.consoleFilters) {
      msg = filter(msg);
      if (msg === null)
        return;
    }
    const formatted = FormatColorTags2(msg);
    this.LogMessage(`[Chat -> ALL] ${msg}`);
    this.bridge.Send({ action: "say", text: formatted });
  }
  PrintToConsole(client, message) {
    const formatted = FormatColorTags2(message);
    if (client === 0) {
      this.LogMessage(formatted);
    } else {
      const escaped = formatted.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
      this.bridge.Send({
        action: "client_command",
        client: String(client),
        cmd: `echo "${escaped}"`
      });
    }
  }
  PrintHintText(client, message) {
    this.bridge.Send({
      action: "hint",
      client: String(client),
      text: FormatColorTags2(message)
    });
  }
  ReplyToCommand(client, message) {
    const formattedMessage = FormatColorTags2(message);
    if (commandSourceStore.getStore() === "console" || client === 0) {
      this.PrintToConsole(client, formattedMessage);
    } else {
      this.PrintToChat(client, formattedMessage);
    }
  }
  GetCmdReplySource() {
    return commandSourceStore.getStore() === "chat" ? 1 /* Chat */ : 0 /* Console */;
  }
  TPrintToChat(client, key, ...args) {
    this.PrintToChat(client, `[T] ${key} ${args.join(" ")}`);
  }
  LoadTranslations(filename) {
    console.log(`[Plugin Manager] Loading translations from: ${filename}`);
  }
  GetMaxClients() {
    return 32;
  }
  GetClientCount(inGameOnly = true) {
    return this.players.GetAll().length;
  }
  GetClientName(client) {
    return this.players.Get(client)?.name ?? "Unknown";
  }
  GetClientAuthId(client) {
    return this.players.Get(client)?.steamId ?? "ID_PENDING";
  }
  GetClientUserId(client) {
    return this.players.Get(client)?.userId ?? 0;
  }
  GetClientHealth(client) {
    return this.players.Get(client)?.GetHealth() ?? 0;
  }
  GetClientMoney(client) {
    return this.players.Get(client)?.GetMoney() ?? 0;
  }
  GetClientTeam(client) {
    return this.players.Get(client)?.GetTeam() ?? 0;
  }
  IsClientInGame(client) {
    return this.players.Get(client) !== undefined;
  }
  IsPlayerAlive(client) {
    return this.players.Get(client)?.IsAlive() ?? false;
  }
  SlapPlayer(client, damage) {
    this.players.Get(client)?.Slap(damage);
  }
  TeleportEntity(client, x, y, z) {
    this.players.Get(client)?.Teleport(x, y, z);
  }
  ChangeClientTeam(client, team) {
    this.players.Get(client)?.SetTeam(team);
  }
  RespawnPlayer(client) {
    this.players.Get(client)?.Respawn();
  }
  KickClient(client, reason) {
    this.players.Get(client)?.Kick(reason);
  }
  BanClient(steamId, reason, adminSteamId, duration, ip = "") {
    this.bridge.Send({ action: "ban", steamid: steamId, duration: duration.toString(), reason, admin: adminSteamId, ip });
  }
  RemoveBan(steamId) {
    this.bridge.Send({ action: "unban", steamid: steamId });
  }
  GivePlayerItem(client, item) {
    this.bridge.Send({ action: "give_item", client: client.toString(), item });
  }
  RemovePlayerItem(client, item) {
    this.bridge.Send({ action: "remove_item", client: client.toString(), item });
  }
  GetClientWeapon(client) {
    return this.players.Get(client)?.GetWeapon() ?? "";
  }
  SetWeaponAmmo(client, weapon, ammo) {
    this.bridge.Send({ action: "set_ammo", client: client.toString(), weapon, ammo: ammo.toString() });
  }
  CreateMenu(title, callback) {
    const menu = new Menu(this.bridge, title);
    return menu;
  }
  SetEntityGravity(client, gravity) {
    this.players.Get(client)?.SetGravity(gravity);
  }
  SetEntityMoveType(client, movetype) {
    this.players.Get(client)?.SetMoveType(movetype);
  }
  SetEntityHealth(client, health) {
    this.players.Get(client)?.SetHealth(health);
  }
  SetEntityModel(client, model) {
    this.players.Get(client)?.SetModel(model);
  }
  SetEntityRenderColor(client, r, g, b, a) {
    this.players.Get(client)?.SetRenderColor(r, g, b, a);
  }
  EmitSoundToClient(client, soundPath, volume, channel, pitch) {
    this.players.Get(client)?.EmitSound(soundPath, volume, channel, pitch);
  }
  EmitSoundToAll(soundPath, volume, channel, pitch) {
    const payload = { action: "play_sound", sound: soundPath, all: "true" };
    if (volume !== undefined)
      payload.volume = volume.toString();
    if (channel !== undefined)
      payload.channel = channel.toString();
    if (pitch !== undefined)
      payload.pitch = pitch.toString();
    this.bridge.Send(payload);
  }
  GetCurrentMap() {
    return this.currentMap;
  }
  CheckCommandAccess(client, command, flags) {
    const player2 = this.players.Get(client);
    if (!player2)
      return false;
    return this.adminManager.HasPermission(player2.steamId, flags);
  }
  GetUserFlagBits(client) {
    const player2 = this.players.Get(client);
    if (!player2)
      return "";
    return this.adminManager.GetFlags(player2.steamId);
  }
  CreateVote(question, options, callback, durationMs = 1e4) {
    if (this.activeVote) {
      console.warn("[Plugin Manager] A vote is already in progress. Cannot start another.");
      return;
    }
    const results = {};
    for (const opt of options) {
      results[opt] = 0;
    }
    const players2 = this.players.GetInGameClients();
    if (players2.length === 0) {
      callback(results);
      return;
    }
    this.activeVote = true;
    this.PrintToChatAll(`{Gold}Oylama Ba\u015Flad\u0131: {Yellow}${question}`);
    const menu = this.CreateMenu(question, (client, info) => {
      if (results[info] !== undefined) {
        results[info]++;
      }
    });
    for (const opt of options) {
      menu.AddItem(opt, opt);
    }
    for (const p of players2) {
      menu.Display(p.index);
    }
    this.activeVoteTimer = setTimeout(() => {
      this.activeVote = false;
      this.activeVoteTimer = null;
      let total = 0;
      for (const v of Object.values(results)) {
        total += v;
      }
      this.PrintToChatAll(`{Gold}Oylama Sonu\xE7land\u0131: {Yellow}${question}`);
      for (const [opt, count] of Object.entries(results)) {
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        this.PrintToChatAll(`{Green}${opt}: {Yellow}${count} oy (%${pct})`);
      }
      callback(results);
    }, durationMs);
  }
  CancelVote() {
    if (!this.activeVote)
      return false;
    if (this.activeVoteTimer) {
      clearTimeout(this.activeVoteTimer);
      this.activeVoteTimer = null;
    }
    this.activeVote = false;
    this.bridge.Send({ action: "command", cmd: "sm_cancelvote_engine" });
    console.log("[Plugin Manager] Active vote cancelled.");
    return true;
  }
  IsVoteInProgress() {
    return this.activeVote;
  }
  GetClientIP(client) {
    return this.players.Get(client)?.GetIPAddress() ?? "127.0.0.1";
  }
  GetClientCountry(client) {
    return this.players.Get(client)?.GetCountry() ?? "Local / Unknown";
  }
  LogToFile(filename, message) {
    try {
      const fs = __require("fs");
      const path = __require("path");
      const logsDir = path.resolve(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      const logFilePath = path.join(logsDir, filename);
      if (fs.existsSync(logFilePath)) {
        const stats = fs.statSync(logFilePath);
        if (stats.size > 5 * 1024 * 1024) {
          const backupPath = logFilePath + ".old";
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          fs.renameSync(logFilePath, backupPath);
        }
      }
      const timestamp = new Date().toISOString();
      fs.appendFileSync(logFilePath, `[${timestamp}] [Core] ${message}
`);
    } catch (e) {
      console.error("[LogToFile] Error writing log:", e);
    }
  }
  GetEngineTime() {
    return this.getEngineTime ? this.getEngineTime() : process.uptime();
  }
  GetTickrate() {
    return 128;
  }
  GetTickInterval() {
    return 1 / 128;
  }
  SetBridgeLatency(latency) {
    this.bridgeLatency = latency;
  }
  GetBridgeLatency() {
    return this.bridgeLatency;
  }
  UnregConsoleCmd(command) {
    this.commands.delete(command);
    console.log(`[Plugin Manager] Unregistered command: ${command}`);
  }
  async LoadPlugin(nameOrPath) {
    const fullPath = resolve2(this.pluginsFolder, nameOrPath);
    if (!existsSync4(fullPath)) {
      if (this.loadedPlugins.has(nameOrPath)) {
        await this.UnloadPlugin(nameOrPath);
      }
      return;
    }
    let entryPoint = fullPath;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      const pkgPath = resolve2(fullPath, "package.json");
      let found = false;
      if (existsSync4(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync3(pkgPath, "utf-8"));
          if (pkg.main) {
            const mainPath = resolve2(fullPath, pkg.main);
            if (existsSync4(mainPath)) {
              entryPoint = mainPath;
              found = true;
            }
          }
        } catch (e) {
          console.error(`[Plugin Manager] Error parsing package.json for ${nameOrPath}:`, e);
        }
      }
      if (!found) {
        const possibleEntries = ["index.ts", "index.js", "main.ts", "main.js"];
        for (const entry of possibleEntries) {
          const entryPath = resolve2(fullPath, entry);
          if (existsSync4(entryPath)) {
            entryPoint = entryPath;
            found = true;
            break;
          }
        }
      }
      if (!found) {
        console.error(`[Plugin Manager] Could not load folder plugin '${nameOrPath}': entry point (index/main) not found.`);
        return;
      }
    }
    if (this.loadedPlugins.has(nameOrPath)) {
      await this.UnloadPlugin(nameOrPath);
    }
    try {
      const modulePath = `${entryPoint}?update=${Date.now()}`;
      const pluginModule = await import(modulePath);
      const PluginClass = pluginModule.default;
      let pluginInstance;
      if (typeof PluginClass === "function") {
        pluginInstance = new PluginClass;
      } else if (PluginClass) {
        pluginInstance = PluginClass;
      } else {
        const name = nameOrPath.replace(/\.(ts|js)$/, "");
        pluginInstance = {
          name,
          version: "1.0.0",
          OnLoad: async (game) => {
            const reserved = new Set(["OnPluginStart", "OnPluginEnd", "default"]);
            for (const key of Object.keys(pluginModule)) {
              const exportVal = pluginModule[key];
              if (!reserved.has(key) && typeof exportVal === "function") {
                game.HookEvent(key, (data) => {
                  exportVal(data);
                });
              }
            }
            if (typeof pluginModule.OnPluginStart === "function") {
              pluginModule.OnPluginStart();
            }
          },
          OnUnload: async () => {
            if (typeof pluginModule.OnPluginEnd === "function") {
              pluginModule.OnPluginEnd();
            }
          }
        };
      }
      if (!pluginInstance) {
        console.error(`[Plugin Manager] Invalid plugin format in ${nameOrPath}`);
        return;
      }
      const pluginName = pluginInstance.name || nameOrPath.replace(/\.(ts|js)$/, "");
      const pluginVersion = pluginInstance.version || "1.0.0";
      const context = new PluginContext(pluginName, this, this.bridge, this.players, this.adminManager, {
        RegConsoleCmd: this.RegConsoleCmd.bind(this),
        UnregConsoleCmd: this.UnregConsoleCmd.bind(this)
      });
      if (typeof PluginClass === "function") {
        const constructor = PluginClass;
        if (Array.isArray(constructor.__commands)) {
          for (const cmd of constructor.__commands) {
            context.RegConsoleCmd(cmd.name, (client, args) => {
              return pluginContextStore.run(context, () => {
                return pluginInstance[cmd.methodName]?.(client, args);
              });
            }, cmd.flags, cmd.description);
            console.log(`[Plugin Manager] Registered decorated command ${cmd.name} to method ${cmd.methodName}`);
          }
        }
        if (Array.isArray(constructor.__eventHooks)) {
          for (const hook of constructor.__eventHooks) {
            context.HookEvent(hook.eventName, (data) => {
              return pluginContextStore.run(context, () => {
                return pluginInstance[hook.methodName]?.(data);
              });
            });
            console.log(`[Plugin Manager] Hooked decorated event ${hook.eventName} to method ${hook.methodName}`);
          }
        }
      }
      const prototype = Object.getPrototypeOf(pluginInstance);
      const allKeys = new Set([
        ...Object.getOwnPropertyNames(pluginInstance),
        ...Object.getOwnPropertyNames(prototype || {})
      ]);
      for (const key of allKeys) {
        if (key.startsWith("On") && key !== "OnLoad" && key !== "OnUnload") {
          const val = pluginInstance[key];
          if (typeof val === "function") {
            const eventName = key.substring(2);
            context.HookEvent(eventName, (data) => {
              pluginContextStore.run(context, () => val.call(pluginInstance, data));
            });
            console.log(`[Plugin Manager] Automatically hooked method ${key} to event: ${eventName}`);
          }
        }
      }
      if (typeof pluginInstance.OnLoad === "function") {
        await pluginContextStore.run(context, () => pluginInstance.OnLoad(context));
      }
      this.loadedPlugins.set(nameOrPath, { plugin: pluginInstance, context });
      this.PrintToServerConsole(`[Plugin Manager] Loaded: ${pluginName} (${pluginVersion}) from ${nameOrPath}`);
    } catch (error) {
      console.error(`[Plugin Manager] Failed to load plugin ${nameOrPath}:`, error);
    }
  }
  async UnloadPlugin(nameOrPath) {
    const entry = this.loadedPlugins.get(nameOrPath);
    if (!entry)
      return;
    try {
      if (entry.plugin.OnUnload) {
        await pluginContextStore.run(entry.context, () => entry.plugin.OnUnload());
      }
      entry.context.Cleanup();
      this.loadedPlugins.delete(nameOrPath);
      this.PrintToServerConsole(`[Plugin Manager] Unloaded: ${entry.plugin.name}`);
    } catch (error) {
      console.error(`[Plugin Manager] Error unloading plugin ${nameOrPath}:`, error);
    }
  }
  async LoadAllPlugins() {
    if (!existsSync4(this.pluginsFolder)) {
      mkdirSync2(this.pluginsFolder, { recursive: true });
    }
    const items = readdirSync(this.pluginsFolder, { withFileTypes: true });
    for (const item of items) {
      if (item.isFile()) {
        const file = item.name;
        if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")) {
          await this.LoadPlugin(file);
        }
      } else if (item.isDirectory()) {
        const folder = item.name;
        await this.LoadPlugin(folder);
      }
    }
    this.PrintToServerConsole("[Plugin System] Plugin system is now active.");
  }
  SetupWatcher() {
    console.log(`[Plugin Manager] Watching for changes in: ${this.pluginsFolder}`);
    this.watcher = watch(this.pluginsFolder, { recursive: true }, (event, filename) => {
      if (!filename)
        return;
      if (filename.endsWith(".d.ts"))
        return;
      if (filename.endsWith(".ts") || filename.endsWith(".js")) {
        const parts = filename.split(/[/\\]/);
        const topLevelName = parts[0];
        if (!topLevelName)
          return;
        console.log(`[Plugin Manager] File changed: ${filename}. Reloading plugin ${topLevelName}...`);
        setTimeout(() => {
          this.LoadPlugin(topLevelName).catch((err) => {
            console.error(`[Plugin Manager] Error reloading plugin ${topLevelName}:`, err);
          });
        }, 100);
      }
    });
  }
  Stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
  pluginStates = new Map;
  GetState(key, initialValue) {
    return this.GetPluginState("global", key, initialValue);
  }
  SetState(key, value) {
    this.SetPluginState("global", key, value);
  }
  GetPluginState(pluginName, key, initialValue) {
    if (!this.pluginStates.has(pluginName)) {
      this.pluginStates.set(pluginName, new Map);
    }
    const states = this.pluginStates.get(pluginName);
    if (!states.has(key)) {
      states.set(key, initialValue);
    }
    return states.get(key);
  }
  SetPluginState(pluginName, key, value) {
    if (!this.pluginStates.has(pluginName)) {
      this.pluginStates.set(pluginName, new Map);
    }
    const states = this.pluginStates.get(pluginName);
    states.set(key, value);
  }
  CreateConVar(name, defaultValue, description) {
    if (this.convars.has(name)) {
      return this.convars.get(name);
    }
    const cvar = new ConVar(name, defaultValue, description, (cname, cval) => {
      this.bridge.Send({ action: "cvar_set", name: cname, value: cval });
    });
    this.convars.set(name, cvar);
    this.bridge.Send({ action: "cvar_register", name, defaultValue, description: description || "" });
    return cvar;
  }
  FindConVar(name) {
    return this.convars.get(name);
  }
  RegClientCookie(name, description) {
    if (this.cookies.has(name)) {
      return this.cookies.get(name);
    }
    const pm = this.players;
    const cookie = new ClientCookie(name, description, pm.db);
    this.cookies.set(name, cookie);
    return cookie;
  }
  FindClientCookie(name) {
    return this.cookies.get(name);
  }
  async SQL_TQuery(sql, args = []) {
    const pm = this.players;
    if (!pm.db) {
      throw new Error("Database not connected.");
    }
    return new Promise((resolve3, reject) => {
      queueMicrotask(() => {
        try {
          const query = pm.db.prepare(sql);
          const rows = query.all(...args);
          resolve3(rows);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  HookEventPre(event, callback) {
    const eventStr = String(event);
    if (!this.preListeners.has(eventStr)) {
      this.preListeners.set(eventStr, []);
      console.log(`[Plugin Manager] Hooking pre-event in Metamod: ${eventStr}`);
      this.bridge.Send({ action: "hook_event", event: eventStr });
    }
    this.preListeners.get(eventStr).push(callback);
  }
  UnhookEventPre(event, callback) {
    const eventStr = String(event);
    const list = this.preListeners.get(eventStr);
    if (list) {
      const idx = list.indexOf(callback);
      if (idx !== -1) {
        list.splice(idx, 1);
      }
      if (list.length === 0) {
        this.preListeners.delete(eventStr);
        console.log(`[Plugin Manager] Unhooking pre-event in Metamod: ${eventStr}`);
        this.bridge.Send({ action: "unhook_event", event: eventStr });
      }
    }
  }
  emit(event, ...args) {
    const eventStr = String(event);
    const preList = this.preListeners.get(eventStr);
    if (preList && preList.length > 0) {
      const data = args[0];
      for (const listener of preList) {
        try {
          const result = listener(data);
          if (result === 3 || result === 4) {
            console.log(`[Plugin Manager] Event ${eventStr} intercepted and BLOCKED by pre-hook.`);
            return false;
          }
        } catch (e) {
          console.error(`[Plugin Manager] Error in pre-listener for event ${eventStr}:`, e);
        }
      }
    }
    return super.emit(event, ...args);
  }
  SDKHook(client, hookType, callback) {
    if (!this.sdkHooks.has(client)) {
      this.sdkHooks.set(client, new Map);
    }
    const clientHooks = this.sdkHooks.get(client);
    const typeKey = hookType;
    if (!clientHooks.has(typeKey)) {
      clientHooks.set(typeKey, []);
      console.log(`[Plugin Manager] Hooking SDK callback for client ${client}: type ${hookType}`);
      this.bridge.Send({ action: "hook_sdk", client, type: hookType });
    }
    clientHooks.get(typeKey).push(callback);
  }
  SDKUnhook(client, hookType, callback) {
    const clientHooks = this.sdkHooks.get(client);
    if (!clientHooks)
      return;
    const typeKey = hookType;
    const callbacks = clientHooks.get(typeKey);
    if (!callbacks)
      return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) {
      callbacks.splice(idx, 1);
    }
    if (callbacks.length === 0) {
      clientHooks.delete(typeKey);
      console.log(`[Plugin Manager] Unhooking SDK callback for client ${client}: type ${hookType}`);
      this.bridge.Send({ action: "unhook_sdk", client, type: hookType });
    }
    if (clientHooks.size === 0) {
      this.sdkHooks.delete(client);
    }
  }
  TriggerSDKHook(client, hookType, ...args) {
    const clientHooks = this.sdkHooks.get(client);
    if (!clientHooks)
      return 0;
    const callbacks = clientHooks.get(hookType);
    if (!callbacks)
      return 0;
    for (const cb of callbacks) {
      try {
        const res = cb(...args);
        if (res !== 0) {
          return res;
        }
      } catch (e) {
        console.error(`[Plugin Manager] Error in SDK hook ${hookType} for client ${client}:`, e);
      }
    }
    return 0;
  }
  RegisterAPI(name, api, pluginName = "core") {
    if (this.sharedAPIs.has(name)) {
      console.warn(`[Plugin Manager] Shared API '${name}' is already registered and will be overwritten.`);
    }
    this.sharedAPIs.set(name, { pluginName, api });
    console.log(`[Plugin Manager] Shared API registered: ${name} (from plugin: ${pluginName})`);
    const pending = this.pendingAPIPromises.get(name);
    if (pending) {
      for (const resolveFn of pending) {
        try {
          resolveFn();
        } catch (err) {
          console.error(`[Plugin Manager] Error resolving pending API promise for '${name}':`, err);
        }
      }
      this.pendingAPIPromises.delete(name);
    }
  }
  UnregisterAPI(name) {
    const entry = this.sharedAPIs.get(name);
    if (entry) {
      this.sharedAPIs.delete(name);
      console.log(`[Plugin Manager] Shared API unregistered: ${name} (from plugin: ${entry.pluginName})`);
    }
  }
  HasAPI(name) {
    return this.sharedAPIs.has(name);
  }
  GetAPI(name) {
    return new Proxy({}, {
      get: (target, prop) => {
        const entry = this.sharedAPIs.get(name);
        if (!entry) {
          throw new Error(`[MetaBun] Shared API '${name}' is not registered or has been unloaded.`);
        }
        const val = entry.api[prop];
        if (typeof val === "function") {
          return val.bind(entry.api);
        }
        return val;
      },
      set: (target, prop, value) => {
        const entry = this.sharedAPIs.get(name);
        if (!entry) {
          throw new Error(`[MetaBun] Shared API '${name}' is not registered or has been unloaded.`);
        }
        entry.api[prop] = value;
        return true;
      },
      has: (target, prop) => {
        const entry = this.sharedAPIs.get(name);
        return entry ? prop in entry.api : false;
      }
    });
  }
  async GetAPIAsync(name) {
    if (this.HasAPI(name)) {
      return this.GetAPI(name);
    }
    return new Promise((resolve3) => {
      if (!this.pendingAPIPromises.has(name)) {
        this.pendingAPIPromises.set(name, []);
      }
      this.pendingAPIPromises.get(name).push(() => {
        resolve3(this.GetAPI(name));
      });
    });
  }
  async Discord_SendMessage(channelId, content) {
    const context = pluginContextStore.getStore();
    const pluginName = context ? context.pluginName : "core";
    return discordService.SendMessage(pluginName, channelId, content);
  }
}

// src/ts/players/manager.ts
init_enums();

// src/ts/shared/database.ts
import { Database } from "bun:sqlite";
import { existsSync as existsSync5, readFileSync as readFileSync4 } from "fs";
import { join as join5 } from "path";

class DatabaseManager {
  db;
  driver = "sqlite";
  dbPath;
  constructor(path = "meta-bun.db") {
    this.dbPath = path;
    this.LoadDriverConfig();
    this.db = new Database(this.dbPath);
    this.Initialize();
  }
  LoadDriverConfig() {
    try {
      const configPath = join5(process.cwd(), "configs", "core", "database.json");
      if (existsSync5(configPath)) {
        const content = readFileSync4(configPath, "utf-8");
        const config = JSON.parse(content);
        this.driver = process.env.DB_DRIVER || config.driver || "sqlite";
        if (this.driver === "mysql" || this.driver === "postgres") {
          const settings = config[this.driver] || {};
          const host = process.env.DB_HOST || settings.host || "127.0.0.1";
          const port = process.env.DB_PORT || settings.port || (this.driver === "mysql" ? 3306 : 5432);
          const user = process.env.DB_USER || settings.user || "root";
          const database = process.env.DB_NAME || settings.database || "meta_bun";
          console.log(`[DatabaseManager] Mocking connection to ${this.driver.toUpperCase()} database at ${host}:${port} (DB: ${database}, User: ${user})`);
        } else {
          console.log(`[DatabaseManager] Initialized with SQLite driver.`);
        }
      } else {
        this.driver = process.env.DB_DRIVER || "sqlite";
        if (this.driver !== "sqlite") {
          console.log(`[DatabaseManager] Mocking connection to ${this.driver.toUpperCase()} database (from env settings)`);
        }
      }
    } catch (err) {
      console.error("[DatabaseManager] Error loading database config, defaulting to SQLite:", err);
      this.driver = "sqlite";
    }
  }
  Initialize() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS players (
        steamid TEXT PRIMARY KEY,
        last_name TEXT,
        total_kills INTEGER DEFAULT 0,
        total_deaths INTEGER DEFAULT 0,
        total_assists INTEGER DEFAULT 0,
        total_headshots INTEGER DEFAULT 0,
        total_damage INTEGER DEFAULT 0,
        total_mvps INTEGER DEFAULT 0,
        total_playtime INTEGER DEFAULT 0,
        is_muted INTEGER DEFAULT 0,
        is_gagged INTEGER DEFAULT 0
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS bans (
        steamid TEXT PRIMARY KEY,
        reason TEXT,
        admin_steamid TEXT,
        duration INTEGER,
        timestamp INTEGER,
        ip TEXT DEFAULT ''
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        steamid TEXT PRIMARY KEY,
        flags TEXT,
        immunity INTEGER DEFAULT 0,
        groups TEXT DEFAULT '',
        expires_at INTEGER DEFAULT 0
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER,
        admin_steamid TEXT,
        admin_name TEXT,
        target_steamid TEXT,
        target_name TEXT,
        action TEXT
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS client_cookies (
        steamid TEXT,
        cookie_name TEXT,
        cookie_value TEXT,
        PRIMARY KEY (steamid, cookie_name)
      )
    `);
    try {
      this.db.run("ALTER TABLE players ADD COLUMN total_headshots INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE players ADD COLUMN total_damage INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE players ADD COLUMN total_mvps INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE players ADD COLUMN total_playtime INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE players ADD COLUMN is_muted INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE players ADD COLUMN is_gagged INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE admins ADD COLUMN expires_at INTEGER DEFAULT 0");
    } catch (_) {}
    try {
      this.db.run("ALTER TABLE bans ADD COLUMN ip TEXT DEFAULT ''");
    } catch (_) {}
  }
  UpsertPlayer(playerData) {
    const query = this.db.prepare(`
      INSERT INTO players (steamid, last_name, total_kills, total_deaths, total_assists, total_headshots, total_damage, total_mvps, total_playtime, is_muted, is_gagged)
      VALUES ($steamid, $last_name, $total_kills, $total_deaths, $total_assists, $total_headshots, $total_damage, $total_mvps, $total_playtime, $is_muted, $is_gagged)
      ON CONFLICT(steamid) DO UPDATE SET
        last_name = excluded.last_name,
        total_kills = total_kills + excluded.total_kills,
        total_deaths = total_deaths + excluded.total_deaths,
        total_assists = total_assists + excluded.total_assists,
        total_headshots = total_headshots + excluded.total_headshots,
        total_damage = total_damage + excluded.total_damage,
        total_mvps = total_mvps + excluded.total_mvps,
        total_playtime = total_playtime + excluded.total_playtime,
        is_muted = excluded.is_muted,
        is_gagged = excluded.is_gagged
    `);
    query.run({
      $steamid: playerData.steamid,
      $last_name: playerData.last_name,
      $total_kills: playerData.total_kills,
      $total_deaths: playerData.total_deaths,
      $total_assists: playerData.total_assists,
      $total_headshots: playerData.total_headshots ?? 0,
      $total_damage: playerData.total_damage ?? 0,
      $total_mvps: playerData.total_mvps ?? 0,
      $total_playtime: playerData.total_playtime ?? 0,
      $is_muted: playerData.is_muted ?? 0,
      $is_gagged: playerData.is_gagged ?? 0
    });
  }
  GetPlayer(steamId) {
    const query = this.db.prepare("SELECT * FROM players WHERE steamid = ?");
    return query.get(steamId);
  }
  AddBan(banData) {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO bans (steamid, reason, admin_steamid, duration, timestamp, ip)
      VALUES ($steamid, $reason, $admin_steamid, $duration, $timestamp, $ip)
    `);
    query.run({
      $steamid: banData.steamid,
      $reason: banData.reason,
      $admin_steamid: banData.admin_steamid,
      $duration: banData.duration,
      $timestamp: banData.timestamp,
      $ip: banData.ip ?? ""
    });
  }
  RemoveBan(steamId) {
    const query = this.db.prepare("DELETE FROM bans WHERE steamid = ?");
    query.run(steamId);
  }
  GetBan(steamId) {
    const query = this.db.prepare("SELECT * FROM bans WHERE steamid = ?");
    return query.get(steamId);
  }
  GetBanByIp(ip) {
    if (!ip)
      return;
    const query = this.db.prepare("SELECT * FROM bans WHERE ip = ?");
    return query.get(ip);
  }
  GetAllBans() {
    const query = this.db.prepare("SELECT * FROM bans");
    return query.all();
  }
  AddDatabaseAdmin(steamid, flags, immunity = 0, groups = "", expires_at = 0) {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO admins (steamid, flags, immunity, [groups], expires_at)
      VALUES ($steamid, $flags, $immunity, $groups, $expires_at)
    `);
    query.run({
      $steamid: steamid,
      $flags: flags,
      $immunity: immunity,
      $groups: groups,
      $expires_at: expires_at
    });
  }
  RemoveDatabaseAdmin(steamid) {
    const query = this.db.prepare("DELETE FROM admins WHERE steamid = ?");
    query.run(steamid);
  }
  GetDatabaseAdmins() {
    const query = this.db.prepare("SELECT * FROM admins");
    return query.all();
  }
  AddAdminLog(adminSteamId, adminName, targetSteamId, targetName, action) {
    const query = this.db.prepare(`
      INSERT INTO admin_logs (timestamp, admin_steamid, admin_name, target_steamid, target_name, action)
      VALUES ($timestamp, $admin_steamid, $admin_name, $target_steamid, $target_name, $action)
    `);
    query.run({
      $timestamp: Date.now(),
      $admin_steamid: adminSteamId,
      $admin_name: adminName,
      $target_steamid: targetSteamId,
      $target_name: targetName,
      $action: action
    });
  }
  SetCookie(steamId, name, value) {
    const query = this.db.prepare(`
      INSERT OR REPLACE INTO client_cookies (steamid, cookie_name, cookie_value)
      VALUES ($steamid, $cookie_name, $cookie_value)
    `);
    query.run({
      $steamid: steamId,
      $cookie_name: name,
      $cookie_value: value
    });
  }
  GetCookie(steamId, name) {
    const query = this.db.prepare("SELECT cookie_value FROM client_cookies WHERE steamid = ? AND cookie_name = ?");
    const row = query.get(steamId, name);
    return row ? row.cookie_value : "";
  }
  prepare(sql) {
    return this.db.prepare(sql);
  }
  run(sql, ...args) {
    return this.db.run(sql, ...args);
  }
  close() {
    this.db.close();
  }
  clearAll() {
    try {
      this.db.run("DELETE FROM players");
      this.db.run("DELETE FROM bans");
      this.db.run("DELETE FROM admins");
      this.db.run("DELETE FROM admin_logs");
      this.db.run("DELETE FROM client_cookies");
    } catch (err) {}
  }
}

// src/ts/players/player.ts
init_enums();
import { EventEmitter as EventEmitter2 } from "events";

// src/ts/shared/geoip.ts
import { existsSync as existsSync6, readFileSync as readFileSync5, writeFileSync as writeFileSync2 } from "fs";
import { join as join6 } from "path";

class GeoIPService {
  ranges = [];
  dbPath = join6(process.cwd(), "configs", "core", "geoip.json");
  constructor() {
    this.Initialize();
  }
  Initialize() {
    if (existsSync6(this.dbPath)) {
      try {
        const content = readFileSync5(this.dbPath, "utf-8");
        const rawRanges = JSON.parse(content);
        this.ranges = rawRanges.map((r) => ({
          start: this.IPToLong(r.start),
          end: this.IPToLong(r.end),
          country: r.country
        })).sort((a, b) => a.start - b.start);
      } catch (err) {
        console.error("[GeoIP] Error loading database, falling back to defaults:", err);
        this.LoadDefaults();
      }
    } else {
      this.LoadDefaults();
      this.SaveDatabase();
    }
  }
  LoadDefaults() {
    const defaults = [
      { start: "1.1.0.0", end: "1.1.255.255", country: "Turkey" },
      { start: "2.2.0.0", end: "2.2.255.255", country: "Germany" },
      { start: "3.3.0.0", end: "3.3.255.255", country: "United States" },
      { start: "4.4.0.0", end: "4.4.255.255", country: "United Kingdom" },
      { start: "5.5.0.0", end: "5.5.255.255", country: "France" },
      { start: "8.8.8.0", end: "8.8.8.255", country: "United States" }
    ];
    this.ranges = defaults.map((r) => ({
      start: this.IPToLong(r.start),
      end: this.IPToLong(r.end),
      country: r.country
    })).sort((a, b) => a.start - b.start);
  }
  SaveDatabase() {
    try {
      const raw = this.ranges.map((r) => ({
        start: this.LongToIP(r.start),
        end: this.LongToIP(r.end),
        country: r.country
      }));
      writeFileSync2(this.dbPath, JSON.stringify(raw, null, 2), "utf-8");
    } catch (err) {
      console.error("[GeoIP] Error saving default database:", err);
    }
  }
  IPToLong(ip) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      return 0;
    }
    return parts[0] * 16777216 + parts[1] * 65536 + parts[2] * 256 + parts[3] >>> 0;
  }
  LongToIP(long) {
    return [
      long >>> 24 & 255,
      long >>> 16 & 255,
      long >>> 8 & 255,
      long & 255
    ].join(".");
  }
  Lookup(ip) {
    if (ip === "127.0.0.1" || ip === "localhost") {
      return "Localhost";
    }
    const ipLong = this.IPToLong(ip);
    if (ipLong === 0) {
      return "Unknown";
    }
    let low = 0;
    let high = this.ranges.length - 1;
    while (low <= high) {
      const mid = low + high >> 1;
      const range = this.ranges[mid];
      if (ipLong >= range.start && ipLong <= range.end) {
        return range.country;
      }
      if (ipLong < range.start) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return "Local / Unknown";
  }
  async UpdateDatabase() {
    try {
      const response = await fetch("https://raw.githubusercontent.com/datasets/geoip2-ipv4/master/data/geoip-ranges.json").catch(() => null);
      if (response && response.ok) {
        const content = await response.text();
        writeFileSync2(this.dbPath, content, "utf-8");
        this.Initialize();
        console.log("[GeoIP] Auto-updated database successfully.");
        return true;
      }
      return false;
    } catch (err) {
      console.error("[GeoIP] Failed to update database:", err);
      return false;
    }
  }
}
var geoIPService = new GeoIPService;

// src/ts/players/player.ts
class Player extends EventEmitter2 {
  bridge;
  adminManager;
  banManager;
  index;
  name;
  steamId;
  userId;
  _health = 100;
  _armor = 0;
  _money = 0;
  _team = 0 /* Unassigned */;
  _kills = 0;
  _deaths = 0;
  _assists = 0;
  _isAlive = true;
  _totalKills = 0;
  _totalDeaths = 0;
  _totalAssists = 0;
  _language = "en";
  _isBot = false;
  _weapon = "";
  _inventory = new Map;
  _location = { x: 0, y: 0, z: 0 };
  _angles = { x: 0, y: 0, z: 0 };
  _isMuted = false;
  _isGagged = false;
  _headshots = 0;
  _damage = 0;
  _mvps = 0;
  _playtime = 0;
  _sessionStartTime = Date.now();
  _lastActiveTime = Date.now();
  _ipAddress = "127.0.0.1";
  _ping = 0;
  _isObserver = false;
  _observerTarget = 0;
  _isForcedObserver = false;
  _entityFlags = 0;
  _buttons = 0;
  _velocity = { x: 0, y: 0, z: 0 };
  _clanTag = "";
  _clip1 = -1;
  _reserve1 = -1;
  steamProfile;
  constructor(bridge, adminManager, banManager, index, name, steamId, userId, isBot = false) {
    super();
    this.bridge = bridge;
    this.adminManager = adminManager;
    this.banManager = banManager;
    this.index = index;
    this.name = name;
    this.steamId = steamId;
    this.userId = userId;
    this._isBot = isBot;
  }
  GetHealth() {
    return this._health;
  }
  GetArmor() {
    return this._armor;
  }
  GetMoney() {
    return this._money;
  }
  GetTeam() {
    return this._team;
  }
  GetKills() {
    return this._kills;
  }
  GetDeaths() {
    return this._deaths;
  }
  GetAssists() {
    return this._assists;
  }
  IsAlive() {
    return this._isAlive;
  }
  GetPing() {
    return this._ping;
  }
  SetPing(ping) {
    this._ping = ping;
  }
  GetTotalKills() {
    return this._totalKills;
  }
  GetTotalDeaths() {
    return this._totalDeaths;
  }
  GetTotalAssists() {
    return this._totalAssists;
  }
  GetLanguage() {
    return this._language;
  }
  IsBot() {
    return this._isBot;
  }
  GetLocation() {
    return this._location;
  }
  GetAngles() {
    return this._angles;
  }
  IsBanned() {
    return this.banManager.CheckBan(this.steamId, this._ipAddress);
  }
  GetAdminFlags() {
    return this.adminManager.GetFlags(this.steamId);
  }
  GetAdminImmunity() {
    return this.adminManager.GetImmunity(this.steamId);
  }
  IsMuted() {
    return this._isMuted;
  }
  IsGagged() {
    return this._isGagged;
  }
  Mute() {
    this._isMuted = true;
    this.emit("MuteChange", true);
  }
  Unmute() {
    this._isMuted = false;
    this.emit("MuteChange", false);
  }
  Gag() {
    this._isGagged = true;
    this.emit("GagChange", true);
  }
  Ungag() {
    this._isGagged = false;
    this.emit("GagChange", false);
  }
  Silence() {
    this.Mute();
    this.Gag();
  }
  Unsilence() {
    this.Unmute();
    this.Ungag();
  }
  GetHeadshots() {
    return this._headshots;
  }
  GetDamage() {
    return this._damage;
  }
  GetMVPs() {
    return this._mvps;
  }
  GetPlaytime() {
    const sessionSeconds = Math.floor((Date.now() - this._sessionStartTime) / 1000);
    return this._playtime + sessionSeconds;
  }
  AddHeadshot() {
    this._headshots++;
    this._lastActiveTime = Date.now();
  }
  AddDamage(val) {
    this._damage += val;
    this._lastActiveTime = Date.now();
  }
  AddMVP() {
    this._mvps++;
  }
  SetAdvancedStats(headshots, damage, mvps, playtime) {
    this._headshots = headshots;
    this._damage = damage;
    this._mvps = mvps;
    this._playtime = playtime;
    this._sessionStartTime = Date.now();
  }
  GetLastActiveTime() {
    return this._lastActiveTime;
  }
  ResetActiveTime() {
    this._lastActiveTime = Date.now();
  }
  GetIdleTime() {
    return Math.floor((Date.now() - this._lastActiveTime) / 1000);
  }
  GetImmunity() {
    return this.adminManager.GetImmunity(this.steamId);
  }
  CanTarget(target) {
    return this.adminManager.CanTarget(this.steamId, target.steamId);
  }
  GetIPAddress() {
    return this._ipAddress;
  }
  SetIPAddress(ip) {
    this._ipAddress = ip;
  }
  GetCountry() {
    return geoIPService.Lookup(this._ipAddress);
  }
  UpdateHealth(value) {
    this._health = value;
    this.emit("HealthChange", value);
  }
  UpdateArmor(value) {
    this._armor = value;
  }
  UpdateMoney(value) {
    this._money = value;
  }
  UpdateTeam(value) {
    this._team = value;
    this.emit("TeamChange", value);
  }
  UpdateKills(value) {
    this._kills = value;
  }
  UpdateDeaths(value) {
    this._deaths = value;
  }
  UpdateAssists(value) {
    this._assists = value;
  }
  UpdateIsAlive(value) {
    const wasAlive = this._isAlive;
    this._isAlive = value;
    if (wasAlive && !value) {
      this.emit("Death");
    }
  }
  SetLanguage(lang) {
    this._language = lang;
  }
  GiveWeapon(weaponName, attributes) {
    this._inventory.set(weaponName, attributes || {});
    this._weapon = weaponName;
    this._lastActiveTime = Date.now();
    this.emit("WeaponChange", weaponName);
  }
  GetWeapon() {
    return this._weapon;
  }
  RemoveWeapon(weaponName) {
    this._inventory.delete(weaponName);
    this._lastActiveTime = Date.now();
    this.emit("WeaponChange", weaponName);
  }
  GetInventory() {
    return this._inventory;
  }
  HasWeapon(weaponName) {
    return this._inventory.has(weaponName);
  }
  UpdateWeapon(weapon) {
    this.GiveWeapon(weapon);
  }
  UpdateLocation(x, y, z) {
    if (this._location.x !== x || this._location.y !== y || this._location.z !== z) {
      this._lastActiveTime = Date.now();
    }
    this._location = { x, y, z };
  }
  UpdateAngles(x, y, z) {
    if (this._angles.x !== x || this._angles.y !== y || this._angles.z !== z) {
      this._lastActiveTime = Date.now();
    }
    this._angles = { x, y, z };
  }
  SetTotalStats(kills, deaths, assists) {
    this._totalKills = kills;
    this._totalDeaths = deaths;
    this._totalAssists = assists;
  }
  Say(message) {
    this._lastActiveTime = Date.now();
    this.bridge.Send({
      action: "say",
      text: `(To ${this.name}) ${message}`
    });
  }
  PrintHintText(message) {
    this.bridge.Send({ action: "hint", client: this.index.toString(), text: message });
  }
  Kick(reason) {
    this.bridge.Send({ action: "kick", client: this.userId.toString(), reason: reason ?? "Kicked by admin" });
  }
  Slap(damage) {
    this.bridge.Send({ action: "slap", client: this.index.toString(), damage: damage.toString() });
  }
  Teleport(x, y, z) {
    this.bridge.Send({ action: "teleport", client: this.index.toString(), x: x.toString(), y: y.toString(), z: z.toString() });
  }
  SetTeam(team) {
    this.bridge.Send({ action: "set_team", client: this.index.toString(), team: team.toString() });
  }
  Respawn() {
    this.bridge.Send({ action: "respawn", client: this.index.toString() });
  }
  SetGravity(gravity) {
    this.bridge.Send({ action: "set_gravity", client: this.index.toString(), gravity: gravity.toString() });
  }
  SetMoveType(movetype) {
    this.bridge.Send({ action: "set_movetype", client: this.index.toString(), movetype: movetype.toString() });
  }
  SetHealth(health) {
    this.bridge.Send({ action: "set_health", client: this.index.toString(), health: health.toString() });
  }
  SetModel(model) {
    this.bridge.Send({ action: "set_model", client: this.index.toString(), model });
  }
  SetRenderColor(r, g, b, a) {
    this.bridge.Send({ action: "set_render_color", client: this.index.toString(), r: r.toString(), g: g.toString(), b: b.toString(), a: a.toString() });
  }
  EmitSound(soundPath, volume, channel, pitch) {
    const payload = { action: "play_sound", client: this.index.toString(), sound: soundPath, all: "false" };
    if (volume !== undefined)
      payload.volume = volume.toString();
    if (channel !== undefined)
      payload.channel = channel.toString();
    if (pitch !== undefined)
      payload.pitch = pitch.toString();
    this.bridge.Send(payload);
  }
  HasFlag(flag) {
    return this.adminManager.HasPermission(this.steamId, flag);
  }
  IsObserver() {
    return this._isObserver;
  }
  GetObserverTarget() {
    return this._observerTarget;
  }
  GetEntityFlags() {
    return this._entityFlags;
  }
  GetButtons() {
    return this._buttons;
  }
  GetVelocity() {
    return this._velocity;
  }
  GetClip1() {
    return this._clip1;
  }
  GetReserve1() {
    return this._reserve1;
  }
  SetVelocity(x, y, z) {
    this._velocity = { x, y, z };
    this.bridge.Send({ action: "set_velocity", client: this.index.toString(), x: x.toString(), y: y.toString(), z: z.toString() });
  }
  UpdateObserverState(isObserver, target, isForced) {
    this._isObserver = isObserver;
    this._observerTarget = target;
    if (isForced !== undefined) {
      this._isForcedObserver = isForced;
    }
  }
  UpdateEntityFlags(flags) {
    this._entityFlags = flags;
  }
  UpdateButtons(buttons) {
    this._buttons = buttons;
  }
  UpdateAmmo(clip, reserve) {
    this._clip1 = clip;
    this._reserve1 = reserve;
  }
  UpdateVelocity(x, y, z) {
    this._velocity = { x, y, z };
  }
  GetClanTag() {
    return this._clanTag;
  }
  SetClanTag(tag) {
    this._clanTag = tag;
    this.bridge.Send({ action: "clan_tag", client: this.index.toString(), tag });
  }
  IsForcedObserver() {
    return this._isForcedObserver;
  }
  SetForcedObserver(forced) {
    this._isForcedObserver = forced;
    this.bridge.Send({ action: "forced_observer", client: this.index.toString(), forced: forced ? "true" : "false" });
  }
  ClientCommand(client, cmd) {
    this.bridge.Send({ action: "client_command", client: client.toString(), cmd });
  }
}

// src/ts/players/manager.ts
import { readFileSync as readFileSync6, existsSync as existsSync7 } from "fs";
import { join as join7 } from "path";

class PlayerManager {
  players = new Map;
  db;
  reservedSlotsConfig = {
    reserved_slots_count: 0,
    kick_method: "highest_idle",
    min_immunity: 10
  };
  consolePlayer = null;
  constructor(db, enableCheckpointing = false) {
    this.db = db || new DatabaseManager;
    this.LoadReservedSlotsConfig();
    if (enableCheckpointing) {
      setInterval(() => this.Checkpoint(), 5 * 60 * 1000);
    }
  }
  LoadReservedSlotsConfig() {
    try {
      const configPath = join7(process.cwd(), "configs", "reserved_slots.json");
      if (existsSync7(configPath)) {
        const content = readFileSync6(configPath, "utf-8");
        this.reservedSlotsConfig = JSON.parse(content);
      }
    } catch (e) {
      console.error("[PlayerManager] Error loading reserved_slots.json:", e);
    }
  }
  Checkpoint() {
    for (const player2 of this.players.values()) {
      this.db.UpsertPlayer({
        steamid: player2.steamId,
        last_name: player2.name,
        total_kills: player2.GetTotalKills(),
        total_deaths: player2.GetTotalDeaths(),
        total_assists: player2.GetTotalAssists(),
        total_headshots: player2.GetHeadshots(),
        total_damage: player2.GetDamage(),
        total_mvps: player2.GetMVPs(),
        total_playtime: player2.GetPlaytime(),
        is_muted: player2.IsMuted() ? 1 : 0,
        is_gagged: player2.IsGagged() ? 1 : 0
      });
    }
  }
  AddPlayer(player2) {
    const existing = this.players.get(player2.index);
    if (existing) {
      console.warn(`[PlayerManager] Slot ${player2.index} already occupied by ${existing.name}. Removing before adding ${player2.name}.`);
      this.RemovePlayer(player2.index);
    }
    const data = this.db.GetPlayer(player2.steamId);
    if (data && player2 instanceof Player) {
      const hasNoStats = player2.GetTotalKills() === 0 && player2.GetTotalDeaths() === 0 && player2.GetTotalAssists() === 0;
      if (hasNoStats) {
        player2.SetTotalStats(data.total_kills, data.total_deaths, data.total_assists);
        player2.SetAdvancedStats(data.total_headshots ?? 0, data.total_damage ?? 0, data.total_mvps ?? 0, data.total_playtime ?? 0);
      }
      if (data.is_muted === 1) {
        player2.Mute();
      }
      if (data.is_gagged === 1) {
        player2.Gag();
      }
    }
    this.players.set(player2.index, player2);
  }
  RemovePlayer(index) {
    const player2 = this.players.get(index);
    if (player2) {
      this.db.UpsertPlayer({
        steamid: player2.steamId,
        last_name: player2.name,
        total_kills: player2.GetTotalKills(),
        total_deaths: player2.GetTotalDeaths(),
        total_assists: player2.GetTotalAssists(),
        total_headshots: player2.GetHeadshots(),
        total_damage: player2.GetDamage(),
        total_mvps: player2.GetMVPs(),
        total_playtime: player2.GetPlaytime(),
        is_muted: player2.IsMuted() ? 1 : 0,
        is_gagged: player2.IsGagged() ? 1 : 0
      });
      this.players.delete(index);
    }
  }
  CheckAFKPlayers(maxIdleSeconds, action = "spec") {
    for (const player2 of this.players.values()) {
      if (player2.GetTeam() !== 1 /* Spectator */) {
        const idle = player2.GetIdleTime();
        if (idle >= maxIdleSeconds) {
          if (action === "spec") {
            player2.SetTeam(1 /* Spectator */);
            player2.Say("You have been moved to spectator for being AFK.");
          } else if (action === "kick") {
            player2.Kick("Kicked for being AFK.");
          }
        }
      }
    }
  }
  CheckReservation(connectingSteamId, connectingFlags, maxClients = 32) {
    const currentClients = this.players.size;
    const slotsLimit = maxClients - this.reservedSlotsConfig.reserved_slots_count;
    const isVip = connectingFlags.includes("a") || connectingFlags.includes("z");
    if (currentClients < slotsLimit) {
      return { allowed: true };
    }
    if (currentClients < maxClients && isVip) {
      return { allowed: true };
    }
    if (!isVip) {
      return { allowed: false };
    }
    let bestCandidate = null;
    if (this.reservedSlotsConfig.kick_method === "highest_ping") {
      let maxPing = -1;
      for (const player2 of this.players.values()) {
        const playerFlags = player2.GetAdminFlags();
        const isPlayerVip = playerFlags.includes("a") || playerFlags.includes("z");
        if (isPlayerVip)
          continue;
        const ping = player2.GetPing();
        if (ping > maxPing) {
          maxPing = ping;
          bestCandidate = player2;
        }
      }
    } else {
      let maxIdleTime = -1;
      for (const player2 of this.players.values()) {
        const playerFlags = player2.GetAdminFlags();
        const isPlayerVip = playerFlags.includes("a") || playerFlags.includes("z");
        if (isPlayerVip)
          continue;
        const idleTime = player2.GetIdleTime();
        if (idleTime > maxIdleTime) {
          maxIdleTime = idleTime;
          bestCandidate = player2;
        }
      }
    }
    if (bestCandidate) {
      return { allowed: true, kickIndex: bestCandidate.index };
    }
    return { allowed: false };
  }
  Get(index) {
    if (index === 0)
      return this.consolePlayer || undefined;
    return this.players.get(index);
  }
  InitializeConsole(bridge, adminManager, banManager) {
    const consolePlayer = new Player(bridge, adminManager, banManager, 0, "Console", "STEAM_ID_SERVER", 0, false);
    this.consolePlayer = consolePlayer;
  }
  FindByName(name) {
    return Array.from(this.players.values()).find((p) => p.name === name);
  }
  FindBySteamId(steamId) {
    return Array.from(this.players.values()).find((p) => p.steamId === steamId);
  }
  GetAll() {
    return Array.from(this.players.values());
  }
  GetClientsByTeam(team) {
    return Array.from(this.players.values()).filter((p) => p.GetTeam() === team);
  }
  GetAliveClients() {
    return Array.from(this.players.values()).filter((p) => p.IsAlive());
  }
  GetInGameClients() {
    return Array.from(this.players.values());
  }
}

// src/ts/admins/manager.ts
import { join as join8 } from "path";
import { readFileSync as readFileSync7, existsSync as existsSync8 } from "fs";

class AdminManager {
  db;
  adminFlags = new Map;
  adminImmunity = new Map;
  adminGroups = new Map;
  adminExpiresAt = new Map;
  groupsConfig = new Map;
  commandOverrides = new Map;
  constructor(db) {
    this.db = db;
    this.LoadAdmins();
  }
  LoadGroups() {
    try {
      const configPath = join8(process.cwd(), "configs", "admins", "groups.json");
      if (existsSync8(configPath)) {
        const content = readFileSync7(configPath, "utf-8");
        const groups = JSON.parse(content);
        for (const [name, entry] of Object.entries(groups)) {
          this.groupsConfig.set(name, {
            flags: entry.flags,
            immunity: entry.immunity ?? 0,
            inherit: entry.inherit
          });
        }
        console.log(`[AdminManager] Loaded ${this.groupsConfig.size} admin groups from config.`);
      }
    } catch (error) {
      console.error(`[AdminManager] Error loading admin groups:`, error);
    }
  }
  LoadOverrides() {
    try {
      const configPath = join8(process.cwd(), "configs", "admins", "overrides.json");
      if (existsSync8(configPath)) {
        const content = readFileSync7(configPath, "utf-8");
        const data = JSON.parse(content);
        if (data.commands) {
          for (const [cmd, flags] of Object.entries(data.commands)) {
            this.commandOverrides.set(cmd, flags);
          }
        }
        console.log(`[AdminManager] Loaded ${this.commandOverrides.size} command overrides from config.`);
      }
    } catch (error) {
      if (error instanceof Error && error.code !== "ENOENT") {
        console.error(`[AdminManager] Error loading command overrides:`, error);
      }
    }
  }
  LoadAdmins() {
    this.adminFlags.clear();
    this.adminImmunity.clear();
    this.adminGroups.clear();
    this.groupsConfig.clear();
    this.commandOverrides.clear();
    this.adminExpiresAt.clear();
    this.LoadGroups();
    this.LoadOverrides();
    try {
      const configPath = join8(process.cwd(), "configs", "admins", "list.json");
      if (existsSync8(configPath)) {
        const content = readFileSync7(configPath, "utf-8");
        const admins = JSON.parse(content);
        const now = Math.floor(Date.now() / 1000);
        for (const [steamId, entry] of Object.entries(admins)) {
          if (typeof entry === "string") {
            this.adminFlags.set(steamId, entry);
            this.adminImmunity.set(steamId, entry.includes("z") ? 99 : 0);
          } else {
            const exp = entry.expires_at ?? entry.expiresAt;
            if (exp && exp > 0 && now >= exp) {
              continue;
            }
            if (entry.flags) {
              this.adminFlags.set(steamId, entry.flags);
            }
            if (entry.immunity !== undefined) {
              this.adminImmunity.set(steamId, entry.immunity);
            }
            if (entry.groups) {
              this.adminGroups.set(steamId, entry.groups);
            }
            if (exp !== undefined) {
              this.adminExpiresAt.set(steamId, exp);
            }
          }
        }
        console.log(`[AdminManager] Loaded ${this.adminFlags.size} admins from config.`);
      } else {
        console.warn(`[AdminManager] Config file not found: ${configPath}`);
      }
    } catch (error) {
      console.error(`[AdminManager] Error loading admins:`, error);
    }
    if (this.db) {
      try {
        const dbAdmins = this.db.GetDatabaseAdmins();
        const now = Math.floor(Date.now() / 1000);
        for (const row of dbAdmins) {
          if (row.expires_at && row.expires_at > 0 && now >= row.expires_at) {
            this.db.RemoveDatabaseAdmin(row.steamid);
            continue;
          }
          if (row.flags) {
            this.adminFlags.set(row.steamid, row.flags);
          }
          if (row.immunity !== undefined) {
            this.adminImmunity.set(row.steamid, row.immunity);
          }
          if (row.groups) {
            const splitGroups = row.groups.split(",").map((g) => g.trim()).filter(Boolean);
            if (splitGroups.length > 0) {
              this.adminGroups.set(row.steamid, splitGroups);
            }
          }
          if (row.expires_at) {
            this.adminExpiresAt.set(row.steamid, row.expires_at);
          }
        }
        console.log(`[AdminManager] Loaded ${dbAdmins.length} admins from SQLite database.`);
      } catch (error) {
        console.error(`[AdminManager] Error loading admins from database:`, error);
      }
    }
  }
  resolveFlags(steamId) {
    const directFlags = this.adminFlags.get(steamId) || "";
    if (directFlags.includes("z"))
      return "z";
    const visitedGroups = new Set;
    const flagsSet = new Set(directFlags.split(""));
    const userGroups = this.adminGroups.get(steamId) || [];
    for (const g of userGroups) {
      this.resolveGroupFlags(g, flagsSet, visitedGroups);
    }
    return Array.from(flagsSet).join("");
  }
  resolveGroupFlags(groupName, flagsSet, visitedGroups) {
    if (visitedGroups.has(groupName))
      return;
    visitedGroups.add(groupName);
    const group = this.groupsConfig.get(groupName);
    if (!group)
      return;
    for (const char of group.flags) {
      flagsSet.add(char);
    }
    if (group.inherit) {
      this.resolveGroupFlags(group.inherit, flagsSet, visitedGroups);
    }
  }
  resolveImmunity(steamId) {
    let maxImmunity = this.adminImmunity.get(steamId) ?? 0;
    const resolvedFlags = this.GetFlags(steamId);
    if (resolvedFlags.includes("z") && maxImmunity < 99) {
      maxImmunity = 99;
    }
    const userGroups = this.adminGroups.get(steamId) || [];
    const visitedGroups = new Set;
    for (const g of userGroups) {
      const gImmunity = this.resolveGroupImmunity(g, visitedGroups);
      if (gImmunity > maxImmunity) {
        maxImmunity = gImmunity;
      }
    }
    return maxImmunity;
  }
  resolveGroupImmunity(groupName, visitedGroups) {
    if (visitedGroups.has(groupName))
      return 0;
    visitedGroups.add(groupName);
    const group = this.groupsConfig.get(groupName);
    if (!group)
      return 0;
    let maxImm = group.immunity;
    if (group.inherit) {
      const inheritImm = this.resolveGroupImmunity(group.inherit, visitedGroups);
      if (inheritImm > maxImm) {
        maxImm = inheritImm;
      }
    }
    return maxImm;
  }
  isExpired(steamId) {
    const expiresAt = this.adminExpiresAt.get(steamId);
    if (expiresAt && expiresAt > 0 && Math.floor(Date.now() / 1000) >= expiresAt) {
      this.adminFlags.delete(steamId);
      this.adminImmunity.delete(steamId);
      this.adminGroups.delete(steamId);
      this.adminExpiresAt.delete(steamId);
      if (this.db) {
        this.db.RemoveDatabaseAdmin(steamId);
      }
      return true;
    }
    return false;
  }
  HasPermission(steamId, flag) {
    const flags = this.GetFlags(steamId);
    if (flags.includes("z"))
      return true;
    return flags.includes(flag);
  }
  GetFlags(steamId) {
    if (this.isExpired(steamId))
      return "";
    return this.resolveFlags(steamId);
  }
  GetImmunity(steamId) {
    if (this.isExpired(steamId))
      return 0;
    return this.resolveImmunity(steamId);
  }
  GetGroups(steamId) {
    if (this.isExpired(steamId))
      return [];
    return this.adminGroups.get(steamId) || [];
  }
  SetImmunity(steamId, level) {
    if (this.isExpired(steamId))
      return;
    this.adminImmunity.set(steamId, level);
    if (this.db) {
      const currentFlags = this.adminFlags.get(steamId) || "";
      const currentGroups = (this.adminGroups.get(steamId) || []).join(",");
      const currentExpiresAt = this.adminExpiresAt.get(steamId) ?? 0;
      this.db.AddDatabaseAdmin(steamId, currentFlags, level, currentGroups, currentExpiresAt);
    }
  }
  CanTarget(adminSteamId, targetSteamId) {
    const adminImmunity = this.GetImmunity(adminSteamId);
    const targetImmunity = this.GetImmunity(targetSteamId);
    return adminImmunity >= targetImmunity;
  }
  SetFlags(steamId, flags) {
    if (this.isExpired(steamId))
      return;
    this.adminFlags.set(steamId, flags);
    const currentImmunity = this.adminImmunity.get(steamId) ?? (flags.includes("z") ? 99 : 0);
    if (!this.adminImmunity.has(steamId)) {
      this.adminImmunity.set(steamId, currentImmunity);
    }
    if (this.db) {
      const currentGroups = (this.adminGroups.get(steamId) || []).join(",");
      const currentExpiresAt = this.adminExpiresAt.get(steamId) ?? 0;
      this.db.AddDatabaseAdmin(steamId, flags, currentImmunity, currentGroups, currentExpiresAt);
    }
  }
  GetCommandOverride(command) {
    return this.commandOverrides.get(command);
  }
  CreateAdmin(steamid, flags, immunity = 0, expiresAt = 0) {
    this.adminFlags.set(steamid, flags);
    this.adminImmunity.set(steamid, immunity);
    this.adminExpiresAt.set(steamid, expiresAt);
    if (this.db) {
      this.db.AddDatabaseAdmin(steamid, flags, immunity, "", expiresAt);
    }
  }
  RemoveAdmin(steamid) {
    this.adminFlags.delete(steamid);
    this.adminImmunity.delete(steamid);
    this.adminGroups.delete(steamid);
    this.adminExpiresAt.delete(steamid);
    if (this.db) {
      this.db.RemoveDatabaseAdmin(steamid);
    }
  }
  AddAdminGroup(groupName, flags, immunity = 0, inherit) {
    this.groupsConfig.set(groupName, { flags, immunity, inherit });
  }
  AddCommandOverride(command, flags) {
    this.commandOverrides.set(command, flags);
  }
  RemoveCommandOverride(command) {
    this.commandOverrides.delete(command);
  }
  LogAction(adminSteamId, adminName, targetSteamId, targetName, action) {
    if (this.db) {
      this.db.AddAdminLog(adminSteamId, adminName, targetSteamId, targetName, action);
    }
  }
  ReloadAdmins() {
    this.LoadAdmins();
    console.log(`[AdminManager] Admin configuration reloaded.`);
  }
}

// src/ts/admins/bans.ts
import { existsSync as existsSync9, readFileSync as readFileSync8 } from "fs";
import { join as join9 } from "path";
class BanManager {
  db;
  settings = null;
  constructor(db) {
    this.db = db;
    this.LoadConfig();
  }
  LoadConfig() {
    try {
      const configPath = join9(process.cwd(), "configs", "core", "settings.json");
      if (existsSync9(configPath)) {
        this.settings = JSON.parse(readFileSync8(configPath, "utf-8"));
      }
    } catch (err) {}
  }
  CheckBan(steamId, ip) {
    let ban = this.db.GetBan(steamId);
    if (!ban && ip) {
      ban = this.db.GetBanByIp(ip);
    }
    if (!ban)
      return false;
    if (ban.duration === 0)
      return true;
    const now = Date.now();
    const expiry = ban.timestamp + ban.duration * 60 * 1000;
    if (expiry <= now) {
      this.db.RemoveBan(ban.steamid);
      return false;
    }
    return true;
  }
  BanClient(steamId, reason, adminSteamId, duration, ip = "") {
    this.db.AddBan({
      steamid: steamId,
      reason,
      admin_steamid: adminSteamId,
      duration,
      timestamp: Date.now(),
      ip
    });
    const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || this.settings?.discord?.log_channel_id;
    if (logChannelId) {
      const durationText = duration === 0 ? "Kal\u0131c\u0131" : `${duration} dakika`;
      const discordPayload = {
        title: "\uD83D\uDEAB Oyuncu Yasakland\u0131",
        color: 16711680,
        fields: [
          { name: "Yasaklanan SteamID", value: steamId, inline: true },
          { name: "S\xFCre", value: durationText, inline: true },
          { name: "Sebep", value: reason, inline: false },
          { name: "Yasaklayan Yetkili", value: adminSteamId, inline: true },
          { name: "IP Adresi", value: ip || "Bilinmiyor", inline: true }
        ],
        timestamp: new Date().toISOString()
      };
      discordService.SendMessage("admin-bans", logChannelId, discordPayload).catch((err) => console.error("[Discord Logger] Ban log failed:", err));
    }
  }
  RemoveBan(steamId) {
    this.db.RemoveBan(steamId);
  }
  SweepExpiredBans() {
    const bans = this.db.GetAllBans();
    const now = Date.now();
    for (const ban of bans) {
      if (ban.duration === 0)
        continue;
      const expiry = ban.timestamp + ban.duration * 60 * 1000;
      if (expiry <= now) {
        this.db.RemoveBan(ban.steamid);
      }
    }
  }
}

// src/ts/index.ts
import { existsSync as existsSync10, readFileSync as readFileSync9 } from "fs";
import { join as join10 } from "path";
function SteamIdTo64(steamId) {
  if (!steamId || steamId === "STEAM_ID_LAN" || steamId === "BOT")
    return null;
  const parts = steamId.match(/^STEAM_(\d+):(\d+):(\d+)$/);
  if (!parts) {
    if (steamId.length === 17 && steamId.startsWith("7656"))
      return steamId;
    return null;
  }
  const y = BigInt(parts[2]);
  const z = BigInt(parts[3]);
  const communityId = z * BigInt(2) + y + BigInt(76561197960265730);
  return communityId.toString();
}

class MetaBunApp {
  port;
  bridge;
  pluginManager;
  playerManager;
  adminManager;
  banManager;
  dbManager;
  socketBuffers = new Map;
  authenticatedSockets = new Set;
  protocol = "ndjson";
  server = null;
  rconServer = null;
  tickIntervalMs = 1000 / 128;
  currentTick = 0;
  engineTime = 0;
  isTickLoopRunning = false;
  nextTickTime = 0;
  tickTimeout = null;
  settings = {};
  constructor(port) {
    this.port = port;
    this.LoadSettings();
    this.bridge = new Bridge;
    this.dbManager = new DatabaseManager;
    this.adminManager = new AdminManager(this.dbManager);
    this.banManager = new BanManager(this.dbManager);
    this.playerManager = new PlayerManager(this.dbManager, false);
    this.playerManager.InitializeConsole(this.bridge, this.adminManager, this.banManager);
    this.pluginManager = new PluginManager(this.bridge, this.playerManager, this.adminManager, true, this.GetEngineTime.bind(this));
    this.protocol = process.env.BRIDGE_PROTOCOL || this.settings.bridge?.protocol || "ndjson";
    this.bridge.SetProtocol(this.protocol);
  }
  LoadSettings() {
    const configPath = join10(process.cwd(), "configs", "core", "settings.json");
    if (existsSync10(configPath)) {
      try {
        this.settings = JSON.parse(readFileSync9(configPath, "utf-8"));
        this.pluginManager.LogMessage("Merkezi ayarlar yuklendi: {Green}configs/core/settings.json{Default}");
      } catch (err) {
        this.pluginManager.LogMessage(`{Red}Hata: settings.json yuklenemedi: ${err}`);
      }
    }
  }
  async Start() {
    this.server = Bun.listen({
      hostname: "0.0.0.0",
      port: this.port,
      reusePort: true,
      socket: {
        open: (socket) => {
          const bunSocket = socket;
          this.socketBuffers.set(bunSocket, Buffer.alloc(0));
          const bridgeToken = process.env.BRIDGE_TOKEN || this.settings.bridge?.token;
          if (!bridgeToken) {
            this.pluginManager.LogMessage("Metamod C++ bridge {Green}baglandi{Default} (Yetki gerekmiyor).");
            this.authenticatedSockets.add(bunSocket);
            this.bridge.SetSocket(bunSocket);
            this.pluginManager.emit("BridgeConnected");
          } else {
            this.pluginManager.LogMessage("Metamod C++ bridge {Green}baglandi{Default}. {Yellow}Yetki bekleniyor...{Default}");
          }
        },
        data: (socket, data) => {
          const bunSocket = socket;
          let buffer = this.socketBuffers.get(bunSocket) || Buffer.alloc(0);
          buffer = Buffer.concat([buffer, data]);
          const bridgeToken = process.env.BRIDGE_TOKEN || this.settings.bridge?.token;
          if (this.protocol === "ndjson") {
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf(10)) !== -1) {
              const lineBuffer = buffer.subarray(0, newlineIndex);
              buffer = buffer.subarray(newlineIndex + 1);
              const line = lineBuffer.toString("utf-8").trim();
              if (line) {
                try {
                  const payload = JSON.parse(line);
                  if (bridgeToken && !this.authenticatedSockets.has(bunSocket)) {
                    const authPayload = payload;
                    if (payload.event === "auth" || authPayload.action === "auth") {
                      if (authPayload.token === bridgeToken) {
                        this.pluginManager.LogMessage("Metamod C++ bridge {Green}yetkilendirildi{Default}.");
                        this.authenticatedSockets.add(bunSocket);
                        this.bridge.SetSocket(bunSocket);
                        this.pluginManager.emit("BridgeConnected");
                        bunSocket.write(JSON.stringify({ event: "auth_success" }) + `
`);
                      } else {
                        this.pluginManager.LogMessage("{Red}Hata: Bridge yetkilendirme basarisiz. Yanlis token.{Default}");
                        bunSocket.write(JSON.stringify({ event: "auth_failed" }) + `
`);
                        bunSocket.close();
                      }
                    } else {
                      this.pluginManager.LogMessage("{Red}Hata: Yetkisiz paket alindi. Baglanti kesiliyor...{Default}");
                      bunSocket.close();
                    }
                    continue;
                  }
                  this.HandlePayload(payload);
                } catch (err) {
                  this.pluginManager.LogMessage(`{Red}Hata: JSON parse hatasi: ${err}`);
                }
              }
            }
            this.socketBuffers.set(bunSocket, buffer);
          } else {
            while (buffer.length >= 4) {
              const length = buffer.readUInt32BE(0);
              if (buffer.length >= 4 + length) {
                const payloadBuffer = buffer.subarray(4, 4 + length);
                buffer = buffer.subarray(4 + length);
                try {
                  let payload;
                  if (this.protocol === "length_prefixed_json") {
                    payload = JSON.parse(payloadBuffer.toString("utf-8"));
                  } else {
                    payload = decode(payloadBuffer);
                  }
                  if (bridgeToken && !this.authenticatedSockets.has(bunSocket)) {
                    const authPayload = payload;
                    if (payload.event === "auth" || authPayload.action === "auth") {
                      if (authPayload.token === bridgeToken) {
                        this.pluginManager.LogMessage("Metamod C++ bridge {Green}yetkilendirildi{Default}.");
                        this.authenticatedSockets.add(bunSocket);
                        this.bridge.SetSocket(bunSocket);
                        this.pluginManager.emit("BridgeConnected");
                      } else {
                        this.pluginManager.LogMessage("{Red}Hata: Bridge yetkilendirme basarisiz. Yanlis token.{Default}");
                        bunSocket.close();
                      }
                    } else {
                      this.pluginManager.LogMessage("{Red}Hata: Yetkisiz paket alindi. Baglanti kesiliyor...{Default}");
                      bunSocket.close();
                    }
                    continue;
                  }
                  this.HandlePayload(payload);
                } catch (err) {
                  this.pluginManager.LogMessage(`{Red}Hata: Ikili paket cozme hatasi: ${err}`);
                }
              } else {
                break;
              }
            }
            this.socketBuffers.set(bunSocket, buffer);
          }
        },
        close: (socket) => {
          this.pluginManager.LogMessage("Metamod C++ bridge {Red}ayrildi{Default}.");
          const bunSocket = socket;
          this.bridge.SetSocket(null);
          this.socketBuffers.delete(bunSocket);
          this.authenticatedSockets.delete(bunSocket);
        },
        error: (socket, error) => {
          this.pluginManager.LogMessage(`{Red}Bridge soket hatasi: ${error}`);
        }
      }
    });
    this.pluginManager.LogMessage(`Soket dinleniyor: {Green}port ${this.port}{Default} (Protokol: {Yellow}${this.protocol}{Default})`);
    const rconPort = Number(process.env.RCON_PORT) || this.settings.rcon?.port || this.port + 10;
    this.rconServer = Bun.listen({
      hostname: "127.0.0.1",
      port: rconPort,
      reusePort: true,
      socket: {
        data: (socket, data) => {
          const str = data.toString("utf-8").trim();
          const parts = str.split(" ");
          const rconPass = process.env.RCON_PASSWORD || this.settings.rcon?.password || "meta-bun-rcon";
          if (parts[0] === rconPass) {
            const cmd = parts.slice(1).join(" ");
            this.pluginManager.ServerCommand(cmd);
            socket.write(`[RCON] Command sent to server: ${cmd}
`);
          } else {
            socket.write(`Invalid RCON password
`);
            socket.close();
          }
        }
      }
    });
    this.pluginManager.LogMessage(`RCON Sunucusu aktif: {Green}port ${rconPort}{Default}`);
    await this.pluginManager.LoadAllPlugins();
    this.isTickLoopRunning = true;
    this.nextTickTime = performance.now();
    this.TickLoop();
  }
  HandlePayload(payload) {
    if (payload.event === "PlayerConnect") {
      const conn = payload;
      const player2 = new Player(this.bridge, this.adminManager, this.banManager, conn.client, conn.name, conn.steamid, conn.userid, conn.isBot ?? false);
      if (conn.language) {
        player2.SetLanguage(conn.language);
      }
      this.playerManager.AddPlayer(player2);
      this.pluginManager.LogMessage(`Oyuncu ba\u011Fland\u0131: {Green}${conn.name}{Default} (ID: ${conn.client}${conn.isBot ? ", BOT" : ""})`);
      const steam64 = SteamIdTo64(conn.steamid);
      const steamApiKey = process.env.STEAM_API_KEY || this.settings.steam_api_key;
      if (steam64 && steamApiKey) {
        fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steam64}`).then((res) => res.json()).then((data) => {
          const playersList = data.response?.players;
          if (playersList && playersList.length > 0) {
            const profile = playersList[0];
            console.log(`[Steam Web API] Profile found for ${conn.name}: avatar = ${profile.avatar}, realname = ${profile.realname || "N/A"}`);
            player2.steamProfile = profile;
          }
        }).catch((err) => {
          console.error(`[Steam Web API] Error fetching summary for ${conn.steamid}:`, err);
        });
      }
      const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || this.settings.discord?.log_channel_id;
      if (logChannelId) {
        const discordPayload = {
          title: "\uD83D\uDCE5 Oyuncu Ba\u011Fland\u0131",
          color: 65280,
          fields: [
            { name: "Oyuncu \u0130smi", value: conn.name, inline: true },
            { name: "SteamID", value: conn.steamid, inline: true },
            { name: "Client ID", value: String(conn.client), inline: true }
          ],
          timestamp: new Date().toISOString()
        };
        discordService.SendMessage("core", logChannelId, discordPayload).catch((err) => console.error("[Discord Logger] Connect log failed:", err));
      }
      this.pluginManager.emit("OnClientPostAdminCheck", { client: conn.client, player: player2 });
    } else if (payload.event === "PlayerDisconnect") {
      const disc = payload;
      const player2 = this.playerManager.Get(disc.client);
      if (player2) {
        this.pluginManager.LogMessage(`Oyuncu ayr\u0131ld\u0131: {Red}${player2.name}{Default} (ID: ${disc.client})`);
        const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || this.settings.discord?.log_channel_id;
        if (logChannelId) {
          const discordPayload = {
            title: "\uD83D\uDCE4 Oyuncu Ayr\u0131ld\u0131",
            color: 16711680,
            fields: [
              { name: "Oyuncu \u0130smi", value: player2.name, inline: true },
              { name: "SteamID", value: player2.steamId, inline: true }
            ],
            timestamp: new Date().toISOString()
          };
          discordService.SendMessage("core", logChannelId, discordPayload).catch((err) => console.error("[Discord Logger] Disconnect log failed:", err));
        }
      } else {
        console.log(`[Bun Core] Player disconnected: index ${disc.client}`);
      }
      this.playerManager.RemovePlayer(disc.client);
    } else if (payload.event === "PlayerStatsUpdate") {
      const stats = payload;
      const player2 = this.playerManager.Get(stats.client);
      if (player2) {
        player2.UpdateHealth(stats.health);
        player2.UpdateArmor(stats.armor);
        player2.UpdateMoney(stats.money);
        player2.UpdateTeam(stats.team);
        player2.UpdateIsAlive(stats.isAlive);
        player2.UpdateLocation(stats.x, stats.y, stats.z);
        player2.UpdateAngles(stats.ax, stats.ay, stats.az);
        player2.UpdateObserverState(stats.isObserver ?? false, stats.observerTarget ?? 0);
        player2.UpdateEntityFlags(stats.entityFlags ?? 0);
        player2.UpdateButtons(stats.buttons ?? 0);
        player2.UpdateAmmo(stats.clip1 ?? -1, stats.reserve1 ?? -1);
        player2.UpdateVelocity(stats.vx ?? 0, stats.vy ?? 0, stats.vz ?? 0);
        if (stats.clanTag !== undefined)
          player2.SetClanTag(stats.clanTag);
        if (stats.ping !== undefined)
          player2.SetPing(stats.ping);
        if (stats.engineTime !== undefined) {
          this.engineTime = stats.engineTime;
        }
      }
    } else if (payload.event === "ping") {
      const pingPayload = payload;
      this.bridge.Send({ action: "pong", timestamp_ms: pingPayload.timestamp_ms });
    } else if (payload.event === "BridgeLatencyUpdate") {
      const latencyPayload = payload;
      this.pluginManager.SetBridgeLatency(latencyPayload.latency);
    }
    this.pluginManager.emit(payload.event, payload);
  }
  GetPluginManager() {
    return this.pluginManager;
  }
  GetBridge() {
    return this.bridge;
  }
  GetAdminManager() {
    return this.adminManager;
  }
  async Stop() {
    this.isTickLoopRunning = false;
    if (this.tickTimeout) {
      clearTimeout(this.tickTimeout);
      this.tickTimeout = null;
    }
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
    if (this.rconServer) {
      this.rconServer.stop();
      this.rconServer = null;
    }
    this.pluginManager.Stop();
  }
  GetEngineTime() {
    return this.engineTime;
  }
  GetCurrentTick() {
    return this.currentTick;
  }
  TickLoop() {
    if (!this.isTickLoopRunning)
      return;
    this.currentTick++;
    this.engineTime = this.currentTick / 128;
    this.pluginManager.emit("GameFrame", {
      event: "GameFrame",
      tick: this.currentTick,
      time: this.engineTime
    });
    const now = performance.now();
    this.nextTickTime += this.tickIntervalMs;
    const delay = Math.max(0, this.nextTickTime - now);
    this.tickTimeout = setTimeout(() => this.TickLoop(), delay);
  }
}
process.on("unhandledRejection", (reason, promise) => {
  console.error("[MetaBun App] Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[MetaBun App] Uncaught Exception:", error);
});
if (import.meta.main) {
  const app = new MetaBunApp(Number(process.env.BRIDGE_PORT) || 27013);
  app.Start();
}
export {
  MetaBunApp
};
