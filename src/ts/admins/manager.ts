import type { IAdminManager } from "../shared/types/admin";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { DatabaseManager } from "../shared/database";

/**
 * Manages administrator permissions, immunity levels, groups, and command overrides.
 */
export class AdminManager implements IAdminManager {
  private adminFlags: Map<string, string> = new Map();
  private adminImmunity: Map<string, number> = new Map();
  private adminGroups: Map<string, string[]> = new Map();
  private adminExpiresAt: Map<string, number> = new Map();

  // Group configurations: groupName -> { flags, immunity, inherit }
  private groupsConfig: Map<string, { flags: string; immunity: number; inherit?: string }> = new Map();

  // Overrides configurations: commandName -> flagString
  private commandOverrides: Map<string, string> = new Map();

  /**
   * Initializes the AdminManager and loads configurations.
   */
  constructor(private db?: DatabaseManager) {
    this.LoadAdmins();
  }

  /**
   * Loads admin groups config from configs/admins/groups.json.
   */
  private LoadGroups(): void {
    try {
      const configPath = join(process.cwd(), "configs", "admins", "groups.json");
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, "utf-8");
        const groups = JSON.parse(content) as Record<string, { flags: string; immunity?: number; inherit?: string }>;
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

  /**
   * Loads command overrides from configs/admins/overrides.json.
   */
  private LoadOverrides(): void {
    try {
      const configPath = join(process.cwd(), "configs", "admins", "overrides.json");
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, "utf-8");
        const data = JSON.parse(content) as { commands?: Record<string, string> };
        if (data.commands) {
          for (const [cmd, flags] of Object.entries(data.commands)) {
            this.commandOverrides.set(cmd, flags);
          }
        }
        console.log(`[AdminManager] Loaded ${this.commandOverrides.size} command overrides from config.`);
      }
    } catch (error) {
      // Do not log error if file doesn't exist, it's optional
      if (error instanceof Error && (error as any).code !== 'ENOENT') {
        console.error(`[AdminManager] Error loading command overrides:`, error);
      }
    }
  }

  /**
   * Loads admin configurations from configs/admins/list.json and SQLite.
   */
  private LoadAdmins(): void {
    this.adminFlags.clear();
    this.adminImmunity.clear();
    this.adminGroups.clear();
    this.groupsConfig.clear();
    this.commandOverrides.clear();
    this.adminExpiresAt.clear();

    this.LoadGroups();
    this.LoadOverrides();

    try {
      const configPath = join(process.cwd(), "configs", "admins", "list.json");

      if (existsSync(configPath)) {
        const content = readFileSync(configPath, "utf-8");
        const admins = JSON.parse(content) as Record<string, string | { flags?: string; immunity?: number; groups?: string[]; expires_at?: number; expiresAt?: number }>;
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

    // Load from Database if active
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
            const splitGroups = row.groups.split(",").map(g => g.trim()).filter(Boolean);
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

  /**
   * Recursively resolves group inheritance and returns all flags.
   */
  private resolveFlags(steamId: string): string {
    const directFlags = this.adminFlags.get(steamId) || "";
    if (directFlags.includes("z")) return "z";

    const visitedGroups = new Set<string>();
    const flagsSet = new Set<string>(directFlags.split(""));

    const userGroups = this.adminGroups.get(steamId) || [];
    for (const g of userGroups) {
      this.resolveGroupFlags(g, flagsSet, visitedGroups);
    }

    return Array.from(flagsSet).join("");
  }

  private resolveGroupFlags(groupName: string, flagsSet: Set<string>, visitedGroups: Set<string>): void {
    if (visitedGroups.has(groupName)) return;
    visitedGroups.add(groupName);

    const group = this.groupsConfig.get(groupName);
    if (!group) return;

    for (const char of group.flags) {
      flagsSet.add(char);
    }

    if (group.inherit) {
      this.resolveGroupFlags(group.inherit, flagsSet, visitedGroups);
    }
  }

  /**
   * Recursively resolves group immunity and returns maximum value.
   */
  private resolveImmunity(steamId: string): number {
    let maxImmunity = this.adminImmunity.get(steamId) ?? 0;
    
    const resolvedFlags = this.GetFlags(steamId);
    if (resolvedFlags.includes("z") && maxImmunity < 99) {
      maxImmunity = 99;
    }

    const userGroups = this.adminGroups.get(steamId) || [];
    const visitedGroups = new Set<string>();
    for (const g of userGroups) {
      const gImmunity = this.resolveGroupImmunity(g, visitedGroups);
      if (gImmunity > maxImmunity) {
        maxImmunity = gImmunity;
      }
    }

    return maxImmunity;
  }

  private resolveGroupImmunity(groupName: string, visitedGroups: Set<string>): number {
    if (visitedGroups.has(groupName)) return 0;
    visitedGroups.add(groupName);

    const group = this.groupsConfig.get(groupName);
    if (!group) return 0;

    let maxImm = group.immunity;
    if (group.inherit) {
      const inheritImm = this.resolveGroupImmunity(group.inherit, visitedGroups);
      if (inheritImm > maxImm) {
        maxImm = inheritImm;
      }
    }

    return maxImm;
  }

  private isExpired(steamId: string): boolean {
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

  /**
   * Checks if an admin has the required permission flag.
   */
  public HasPermission(steamId: string, flag: string): boolean {
    const flags = this.GetFlags(steamId);
    if (flags.includes("z")) return true;
    return flags.includes(flag);
  }

  /**
   * Gets all flags assigned to a SteamID.
   */
  public GetFlags(steamId: string): string {
    if (this.isExpired(steamId)) return "";
    return this.resolveFlags(steamId);
  }

  /**
   * Gets the immunity level of a SteamID.
   */
  public GetImmunity(steamId: string): number {
    if (this.isExpired(steamId)) return 0;
    return this.resolveImmunity(steamId);
  }

  /**
   * Gets all groups associated with the specified SteamID.
   */
  public GetGroups(steamId: string): string[] {
    if (this.isExpired(steamId)) return [];
    return this.adminGroups.get(steamId) || [];
  }

  /**
   * Set the immunity level of a SteamID in memory (and SQLite if active).
   */
  public SetImmunity(steamId: string, level: number): void {
    if (this.isExpired(steamId)) return;
    this.adminImmunity.set(steamId, level);
    if (this.db) {
      const currentFlags = this.adminFlags.get(steamId) || "";
      const currentGroups = (this.adminGroups.get(steamId) || []).join(",");
      const currentExpiresAt = this.adminExpiresAt.get(steamId) ?? 0;
      this.db.AddDatabaseAdmin(steamId, currentFlags, level, currentGroups, currentExpiresAt);
    }
  }

  /**
   * Compares immunity levels between two SteamIDs to verify targeting access.
   */
  public CanTarget(adminSteamId: string, targetSteamId: string): boolean {
    const adminImmunity = this.GetImmunity(adminSteamId);
    const targetImmunity = this.GetImmunity(targetSteamId);
    return adminImmunity >= targetImmunity;
  }

  /**
   * Dynamically assign permissions to a SteamID in memory (and SQLite if active).
   */
  public SetFlags(steamId: string, flags: string): void {
    if (this.isExpired(steamId)) return;
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

  /**
   * Checks if there is a command override flag defined for a console command.
   */
  public GetCommandOverride(command: string): string | undefined {
    return this.commandOverrides.get(command);
  }

  /**
   * Dynamically creates/saves an admin to database/memory.
   */
  public CreateAdmin(steamid: string, flags: string, immunity: number = 0, expiresAt: number = 0): void {
    this.adminFlags.set(steamid, flags);
    this.adminImmunity.set(steamid, immunity);
    this.adminExpiresAt.set(steamid, expiresAt);
    if (this.db) {
      this.db.AddDatabaseAdmin(steamid, flags, immunity, "", expiresAt);
    }
  }

  /**
   * Dynamically removes a runtime admin from database/memory.
   */
  public RemoveAdmin(steamid: string): void {
    this.adminFlags.delete(steamid);
    this.adminImmunity.delete(steamid);
    this.adminGroups.delete(steamid);
    this.adminExpiresAt.delete(steamid);
    if (this.db) {
      this.db.RemoveDatabaseAdmin(steamid);
    }
  }

  /**
   * Dynamically defines a runtime admin group.
   */
  public AddAdminGroup(groupName: string, flags: string, immunity: number = 0, inherit?: string): void {
    this.groupsConfig.set(groupName, { flags, immunity, inherit });
  }

  /**
   * Dynamically registers a command access flag override at runtime.
   */
  public AddCommandOverride(command: string, flags: string): void {
    this.commandOverrides.set(command, flags);
  }

  /**
   * Dynamically removes a command access override at runtime.
   */
  public RemoveCommandOverride(command: string): void {
    this.commandOverrides.delete(command);
  }

  /**
   * Logs an admin action in the database.
   */
  public LogAction(adminSteamId: string, adminName: string, targetSteamId: string, targetName: string, action: string): void {
    if (this.db) {
      this.db.AddAdminLog(adminSteamId, adminName, targetSteamId, targetName, action);
    }
  }

  /**
   * Reloads admin configuration from configs/admins.json at runtime.
   */
  public ReloadAdmins(): void {
    this.LoadAdmins();
    console.log(`[AdminManager] Admin configuration reloaded.`);
  }
}
