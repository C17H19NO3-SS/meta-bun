import type { ClientCookie as IClientCookie } from "../shared/types/bridge";
import { DatabaseManager } from "../shared/database";

export class ClientCookie implements IClientCookie {
  constructor(
    private name: string,
    private description: string,
    private db: DatabaseManager
  ) {}

  public GetName(): string {
    return this.name;
  }

  public Get(client: number): string {
    const steamId = this.GetSteamId(client);
    if (!steamId) return "";
    return this.db.GetCookie(steamId, this.name);
  }

  public Set(client: number, value: string): void {
    const steamId = this.GetSteamId(client);
    if (!steamId) return;
    this.db.SetCookie(steamId, this.name, value);
  }

  private GetSteamId(client: number): string | null {
    try {
      // Lazy load core to avoid circular dependency
      const { players } = require("meta-bun/core");
      const p = players.Get(client);
      return p ? p.steamId : null;
    } catch {
      return null;
    }
  }
}
