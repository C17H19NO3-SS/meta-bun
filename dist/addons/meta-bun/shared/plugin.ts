import type { IPlugin } from "./types/plugin";
import type { IGameBridge } from "./types/bridge";
import type { GameEvent, PlayerChatEvent, PlayerSpawnEvent, PlayerDeathEvent, WeaponFireEvent, RoundStartEvent, RoundEndEvent, PlayerConnectEvent, PlayerDisconnectEvent } from "./types/events";

interface CommandDecorator {
  name: string;
  methodName: string;
  flags: string | null;
  description: string | null;
}

interface HookDecorator {
  eventName: string;
  methodName: string;
}

/**
 * Base abstract class that all MetaBun plugins must extend.
 * Handles lifecycle registrations and basic properties.
 */
export abstract class BasePlugin implements IPlugin {
  /** The unique name of the plugin. */
  public name: string | null = null;
  
  /** The version string of the plugin (e.g. "1.0.0"). */
  public version: string | null = null;
  
  /** The author/developer of the plugin. */
  public author: string | null = null;

  constructor() {
    const originalOnLoad = this.OnLoad;
    this.OnLoad = async (game: IGameBridge) => {
      const constructor = this.constructor as unknown as { __commands?: CommandDecorator[]; __eventHooks?: HookDecorator[] };
      if (Array.isArray(constructor.__commands)) {
        for (const cmd of constructor.__commands) {
          game.RegConsoleCmd(
            cmd.name,
            (client: number, args: string[]) => {
              const method = (this as unknown as Record<string, (c: number, a: string[]) => void>)[cmd.methodName];
              if (typeof method === "function") {
                return method.call(this, client, args);
              }
            },
            cmd.flags,
            cmd.description
          );
        }
      }
      if (Array.isArray(constructor.__eventHooks)) {
        for (const hook of constructor.__eventHooks) {
          game.HookEvent(hook.eventName, (data: GameEvent) => {
            const method = (this as unknown as Record<string, (d: GameEvent) => void>)[hook.methodName];
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

  /**
   * Called when the plugin is loaded into the plugin manager.
   * Initialize resources, hooks, and commands here.
   * 
   * @param game Scoped engine bridge interface context.
   */
  public OnLoad?(game: IGameBridge): void | Promise<void>;

  /**
   * Optional cleanup callback when the plugin is unloaded.
   */
  public OnUnload?(): void | Promise<void>;

  // Predefined event hook methods. Overriding them will auto-register them.
  public OnPlayerChat?(data: PlayerChatEvent): void | Promise<void>;
  public OnPlayerSpawned?(data: PlayerSpawnEvent): void | Promise<void>;
  public OnGameFrame?(data: GameEvent): void | Promise<void>;
  public OnClientConnect?(data: PlayerConnectEvent): void | Promise<void>;
  public OnClientDisconnect?(data: PlayerDisconnectEvent): void | Promise<void>;
  public OnMenuSelect?(data: GameEvent): void | Promise<void>;
  public OnPlayerDeath?(data: PlayerDeathEvent): void | Promise<void>;
  public OnWeaponChange?(data: WeaponFireEvent): void | Promise<void>;
  public OnHealthChange?(data: GameEvent): void | Promise<void>;
  public OnTeamChange?(data: GameEvent): void | Promise<void>;
  public OnMapStart?(data: GameEvent): void | Promise<void>;
  public OnMapEnd?(data: GameEvent): void | Promise<void>;

  [key: string]: unknown;
}
