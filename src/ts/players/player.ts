import { EventEmitter } from "node:events";
import type { IPlayer, SteamProfile } from "../shared/types/player";
import type { IAdminManager } from "../shared/types/admin";
import type { BanManager } from "../admins/bans";
import { Team } from "../shared/types/enums";
import { Bridge } from "../network/bridge";
import type { Weapon } from "../shared/types/weapon";
import { geoIPService } from "../shared/geoip";

/**
 * Represents a player session on the server.
 * Handles stats, movement, actions, and communicates with the C++ Metamod bridge.
 */
export class Player extends EventEmitter implements IPlayer {
  private _health: number = 100;
  private _armor: number = 0;
  private _money: number = 0;
  private _team: Team = Team.Unassigned;
  private _kills: number = 0;
  private _deaths: number = 0;
  private _assists: number = 0;
  private _isAlive: boolean = true;
  private _totalKills: number = 0;
  private _totalDeaths: number = 0;
  private _totalAssists: number = 0;
  private _language: string = "en";
  private _isBot: boolean = false;
  private _weapon: string = "";
  private _inventory: Map<string, Weapon> = new Map();
  private _location: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private _angles: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  // Advanced features state
  private _isMuted: boolean = false;
  private _isGagged: boolean = false;
  private _headshots: number = 0;
  private _damage: number = 0;
  private _mvps: number = 0;
  private _playtime: number = 0; // Persistent playtime accumulator (seconds)
  private _sessionStartTime: number = Date.now();
  private _lastActiveTime: number = Date.now();
  private _ipAddress: string = "127.0.0.1";
  private _ping: number = 0;
  private _isObserver: boolean = false;
  private _observerTarget: number = 0;
  private _isForcedObserver: boolean = false;
  private _entityFlags: number = 0;
  private _buttons: number = 0;
  private _velocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };
  private _clanTag: string = "";
  private _clip1: number = -1;
  private _reserve1: number = -1;

  public steamProfile?: SteamProfile;

  /**
   * Initializes the Player session instance.
   */
  constructor(
    private bridge: Bridge,
    private adminManager: IAdminManager,
    private banManager: BanManager,
    public readonly index: number,
    public readonly name: string,
    public readonly steamId: string,
    public readonly userId: number,
    isBot: boolean = false
  ) {
    super();
    this._isBot = isBot;
  }

  // Getters
  public GetHealth(): number { return this._health; }
  public GetArmor(): number { return this._armor; }
  public GetMoney(): number { return this._money; }
  public GetTeam(): Team { return this._team; }
  public GetKills(): number { return this._kills; }
  public GetDeaths(): number { return this._deaths; }
  public GetAssists(): number { return this._assists; }
  public IsAlive(): boolean { return this._isAlive; }
  public GetPing(): number { return this._ping; }
  public SetPing(ping: number): void { this._ping = ping; }
  public GetTotalKills(): number { return this._totalKills; }
  public GetTotalDeaths(): number { return this._totalDeaths; }
  public GetTotalAssists(): number { return this._totalAssists; }
  public GetLanguage(): string { return this._language; }
  public IsBot(): boolean { return this._isBot; }
  public GetLocation(): { x: number; y: number; z: number } { return this._location; }
  public GetAngles(): { x: number; y: number; z: number } { return this._angles; }

  /**
   * Check if this player is currently banned.
   * Expired bans are cleaned up automatically.
   */
  public IsBanned(): boolean {
    return this.banManager.CheckBan(this.steamId, this._ipAddress);
  }

  public GetAdminFlags(): string {
    return this.adminManager.GetFlags(this.steamId);
  }

  public GetAdminImmunity(): number {
    return this.adminManager.GetImmunity(this.steamId);
  }

  // Mute / Gag System
  public IsMuted(): boolean { return this._isMuted; }
  public IsGagged(): boolean { return this._isGagged; }
  public Mute(): void { this._isMuted = true; this.emit("MuteChange", true); }
  public Unmute(): void { this._isMuted = false; this.emit("MuteChange", false); }
  public Gag(): void { this._isGagged = true; this.emit("GagChange", true); }
  public Ungag(): void { this._isGagged = false; this.emit("GagChange", false); }
  public Silence(): void { this.Mute(); this.Gag(); }
  public Unsilence(): void { this.Unmute(); this.Ungag(); }

  // Detailed Stat Tracking
  public GetHeadshots(): number { return this._headshots; }
  public GetDamage(): number { return this._damage; }
  public GetMVPs(): number { return this._mvps; }
  public GetPlaytime(): number {
    const sessionSeconds = Math.floor((Date.now() - this._sessionStartTime) / 1000);
    return this._playtime + sessionSeconds;
  }
  public AddHeadshot(): void { this._headshots++; this._lastActiveTime = Date.now(); }
  public AddDamage(val: number): void { this._damage += val; this._lastActiveTime = Date.now(); }
  public AddMVP(): void { this._mvps++; }
  
  /**
   * Set the advanced statistics of the player.
   */
  public SetAdvancedStats(headshots: number, damage: number, mvps: number, playtime: number): void {
    this._headshots = headshots;
    this._damage = damage;
    this._mvps = mvps;
    this._playtime = playtime;
    this._sessionStartTime = Date.now();
  }

  // AFK & Activity Tracking
  public GetLastActiveTime(): number { return this._lastActiveTime; }
  public ResetActiveTime(): void { this._lastActiveTime = Date.now(); }
  public GetIdleTime(): number { return Math.floor((Date.now() - this._lastActiveTime) / 1000); }

  // Admin Immunity
  public GetImmunity(): number { return this.adminManager.GetImmunity(this.steamId); }
  public CanTarget(target: Player): boolean { return this.adminManager.CanTarget(this.steamId, target.steamId); }

  // GeoIP / Country Detection
  public GetIPAddress(): string { return this._ipAddress; }
  public SetIPAddress(ip: string): void { this._ipAddress = ip; }
  
  /**
   * Resolves country lookup dynamically using geoIPService.
   */
  public GetCountry(): string {
    return geoIPService.Lookup(this._ipAddress);
  }

  // State updaters — called by bridge event handlers
  public UpdateHealth(value: number): void { 
    this._health = value;
    this.emit("HealthChange", value);
  }
  public UpdateArmor(value: number): void { this._armor = value; }
  public UpdateMoney(value: number): void { this._money = value; }
  public UpdateTeam(value: Team): void { 
    this._team = value;
    this.emit("TeamChange", value);
  }
  public UpdateKills(value: number): void { this._kills = value; }
  public UpdateDeaths(value: number): void { this._deaths = value; }
  public UpdateAssists(value: number): void { this._assists = value; }
  public UpdateIsAlive(value: boolean): void {
    const wasAlive = this._isAlive;
    this._isAlive = value;
    if (wasAlive && !value) {
      this.emit("Death");
    }
  }
  public SetLanguage(lang: string): void { this._language = lang; }
  
  /**
   * Give weapon item to inventory.
   */
  public GiveWeapon(weaponName: string, attributes?: Weapon): void {
    this._inventory.set(weaponName, attributes || {});
    this._weapon = weaponName;
    this._lastActiveTime = Date.now();
    this.emit("WeaponChange", weaponName);
  }

  public GetWeapon(): string { return this._weapon; }
  
  /**
   * Removes a weapon item from inventory.
   */
  public RemoveWeapon(weaponName: string): void {
    this._inventory.delete(weaponName);
    this._lastActiveTime = Date.now();
    this.emit("WeaponChange", weaponName);
  }
  
  public GetInventory(): Map<string, Weapon> {
    return this._inventory;
  }
  
  public HasWeapon(weaponName: string): boolean {
    return this._inventory.has(weaponName);
  }

  public UpdateWeapon(weapon: string): void { 
    this.GiveWeapon(weapon);
  }
  
  public UpdateLocation(x: number, y: number, z: number): void {
    if (this._location.x !== x || this._location.y !== y || this._location.z !== z) {
      this._lastActiveTime = Date.now();
    }
    this._location = { x, y, z };
  }
  
  public UpdateAngles(x: number, y: number, z: number): void {
    if (this._angles.x !== x || this._angles.y !== y || this._angles.z !== z) {
      this._lastActiveTime = Date.now();
    }
    this._angles = { x, y, z };
  }

  /**
   * Sets persistent statistics.
   */
  public SetTotalStats(kills: number, deaths: number, assists: number): void {
    this._totalKills = kills;
    this._totalDeaths = deaths;
    this._totalAssists = assists;
  }

  // Action methods forwarding commands through the network Bridge
  public Say(message: string): void {
    this._lastActiveTime = Date.now();
    this.bridge.Send({ 
      action: "say", 
      text: `(To ${this.name}) ${message}` 
    });
  }

  public PrintHintText(message: string): void {
    this.bridge.Send({ action: "hint", client: this.index.toString(), text: message });
  }

  public Kick(reason?: string): void {
    this.bridge.Send({ action: "kick", client: this.userId.toString(), reason: reason ?? "Kicked by admin" });
  }

  public Slap(damage: number): void {
    this.bridge.Send({ action: "slap", client: this.index.toString(), damage: damage.toString() });
  }

  public Teleport(x: number, y: number, z: number): void {
    this.bridge.Send({ action: "teleport", client: this.index.toString(), x: x.toString(), y: y.toString(), z: z.toString() });
  }

  public SetTeam(team: Team): void {
    this.bridge.Send({ action: "set_team", client: this.index.toString(), team: team.toString() });
  }

  public Respawn(): void {
    this.bridge.Send({ action: "respawn", client: this.index.toString() });
  }

  public SetGravity(gravity: number): void {
    this.bridge.Send({ action: "set_gravity", client: this.index.toString(), gravity: gravity.toString() });
  }

  public SetMoveType(movetype: number): void {
    this.bridge.Send({ action: "set_movetype", client: this.index.toString(), movetype: movetype.toString() });
  }

  public SetHealth(health: number): void {
    this.bridge.Send({ action: "set_health", client: this.index.toString(), health: health.toString() });
  }

  public SetModel(model: string): void {
    this.bridge.Send({ action: "set_model", client: this.index.toString(), model });
  }

  public SetRenderColor(r: number, g: number, b: number, a: number): void {
    this.bridge.Send({ action: "set_render_color", client: this.index.toString(), r: r.toString(), g: g.toString(), b: b.toString(), a: a.toString() });
  }

  public EmitSound(soundPath: string, volume?: number, channel?: number, pitch?: number): void {
    const payload: any = { action: "play_sound", client: this.index.toString(), sound: soundPath, all: "false" };
    if (volume !== undefined) payload.volume = volume.toString();
    if (channel !== undefined) payload.channel = channel.toString();
    if (pitch !== undefined) payload.pitch = pitch.toString();
    this.bridge.Send(payload);
  }

  public HasFlag(flag: string): boolean {
    return this.adminManager.HasPermission(this.steamId, flag);
  }

  // Advanced SourceMod Features
  public IsObserver(): boolean { return this._isObserver; }
  public GetObserverTarget(): number { return this._observerTarget; }
  public GetEntityFlags(): number { return this._entityFlags; }
  public GetButtons(): number { return this._buttons; }
  public GetVelocity(): { x: number; y: number; z: number } { return this._velocity; }
  public GetClip1(): number { return this._clip1; }
  public GetReserve1(): number { return this._reserve1; }
  
  public SetVelocity(x: number, y: number, z: number): void {
    this._velocity = { x, y, z };
    this.bridge.Send({ action: "set_velocity", client: this.index.toString(), x: x.toString(), y: y.toString(), z: z.toString() });
  }

  public UpdateObserverState(isObserver: boolean, target: number, isForced?: boolean): void {
    this._isObserver = isObserver;
    this._observerTarget = target;
    if (isForced !== undefined) {
      this._isForcedObserver = isForced;
    }
  }

  public UpdateEntityFlags(flags: number): void {
    this._entityFlags = flags;
  }

  public UpdateButtons(buttons: number): void {
    this._buttons = buttons;
  }

  public UpdateAmmo(clip: number, reserve: number): void {
    this._clip1 = clip;
    this._reserve1 = reserve;
  }

  public UpdateVelocity(x: number, y: number, z: number): void {
    this._velocity = { x, y, z };
  }

  public GetClanTag(): string {
    return this._clanTag;
  }

  public SetClanTag(tag: string): void {
    this._clanTag = tag;
    this.bridge.Send({ action: "clan_tag", client: this.index.toString(), tag });
  }

  public IsForcedObserver(): boolean {
    return this._isForcedObserver;
  }

  public SetForcedObserver(forced: boolean): void {
    this._isForcedObserver = forced;
    this.bridge.Send({ action: "forced_observer", client: this.index.toString(), forced: forced ? "true" : "false" });
  }

  public ClientCommand(client: number, cmd: string): void {
    this.bridge.Send({ action: "client_command", client: client.toString(), cmd });
  }
}
