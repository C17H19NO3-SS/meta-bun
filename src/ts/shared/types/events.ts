/**
 * Central map of all game events and their corresponding data interfaces.
 * This is used for strict type safety and IntelliSense.
 */
export interface EventMap {
	PlayerChat: PlayerChatEvent;
	PlayerConnect: PlayerConnectEvent;
	PlayerDisconnect: PlayerDisconnectEvent;
	PlayerStatsUpdate: PlayerStatsUpdateEvent;
	PlayerSpawn: PlayerSpawnEvent;
	PlayerDeath: PlayerDeathEvent;
	WeaponFire: WeaponFireEvent;
	BombPlanted: BombPlantedEvent;
	BombDefused: BombDefusedEvent;
	BombExploded: BombExplodedEvent;
	HostageRescued: HostageRescuedEvent;
	ItemPickup: ItemPickupEvent;
	RoundStart: RoundStartEvent;
	RoundEnd: RoundEndEvent;
	MapStart: MapStartEvent;
	MapEnd: MapEndEvent;
	GameFrame: GameFrameEvent;
	ConsoleCommand: ConsoleCommandEvent;
	ping: PingEvent;
	BridgeLatencyUpdate: BridgeLatencyUpdateEvent;
	auth: AuthEvent;
}

/**
 * Base interface for all game events received from the C++ Metamod bridge.
 */
export interface GameEvent {
	event: string;
	[key: string]: string | number | boolean | undefined;
}

/**
 * Emitted when a player sends a console command.
 */
export interface ConsoleCommandEvent extends GameEvent {
	event: "ConsoleCommand";
	client: number;
	command: string;
	args: string;
}

/**
 * Emitted when a player sends a chat message.
 */
export interface PlayerChatEvent extends GameEvent {
	event: "PlayerChat";
	client: number;
	text: string;
	/** Whether the message was sent to team-only chat. */
	team_only: boolean;
}

/**
 * Emitted when a player connects to the server.
 */
export interface PlayerConnectEvent extends GameEvent {
	event: "PlayerConnect";
	client: number;
	name: string;
	steamid: string;
	userid: number;
	/** Whether the connecting client is a bot. */
	isBot: boolean;
	/**
	 * Preferred language code of the player (e.g. "en", "tr").
	 * Optional — not all bridge implementations send this field.
	 */
	language?: string;
	/**
	 * IP address of the connecting player.
	 */
	ip?: string;
}

/**
 * Emitted when a player disconnects from the server.
 */
export interface PlayerDisconnectEvent extends GameEvent {
	event: "PlayerDisconnect";
	client: number;
	reason: string;
}

/**
 * Emitted periodically by the C++ bridge to synchronize player state.
 * Carries position, angle, and live game stats.
 */
export interface PlayerStatsUpdateEvent extends GameEvent {
	event: "PlayerStatsUpdate";
	client: number;
	health: number;
	armor: number;
	money: number;
	team: number;
	isAlive: boolean;
	engineTime?: number;
	maxClients?: number;
	/** World X position. */
	x: number;
	/** World Y position. */
	y: number;
	/** World Z position. */
	z: number;
	/** View angle pitch (X). */
	ax: number;
	/** View angle yaw (Y). */
	ay: number;
	/** View angle roll (Z). */
	az: number;

	// New properties for advanced SM features
	isObserver?: boolean;
	observerTarget?: number;
	entityFlags?: number;
	buttons?: number;
	vx?: number;
	vy?: number;
	vz?: number;
	clanTag?: string;
	ping?: number;
	clip1?: number;
	reserve1?: number;
}

/**
 * Emitted by bridge for latency measurements.
 */
export interface PingEvent extends GameEvent {
	event: "ping";
	timestamp_ms: number;
}

/**
 * Emitted when bridge latency is calculated.
 */
export interface BridgeLatencyUpdateEvent extends GameEvent {
	event: "BridgeLatencyUpdate";
	latency: number;
}

/**
 * Emitted for bridge authentication.
 */
export interface AuthEvent extends GameEvent {
	event: "auth";
	token: string;
	action?: string;
}

/**
 * Emitted when a player spawns in-game.
 */
export interface PlayerSpawnEvent extends GameEvent {
	event: "PlayerSpawn";
	client: number;
	team: number;
}

/**
 * Emitted when a player dies.
 */
export interface PlayerDeathEvent extends GameEvent {
	event: "PlayerDeath";
	/** Victim client index. */
	client: number;
	/** Attacker client index. */
	attacker: number;
	/** Assisting player client index (if any). */
	assister?: number;
	/** Whether the kill was a headshot. */
	headshot: boolean;
	/** Name of the weapon used. */
	weapon: string;
}

/**
 * Emitted when a player fires a weapon.
 */
export interface WeaponFireEvent extends GameEvent {
	event: "WeaponFire";
	client: number;
	weapon: string;
}

/**
 * Emitted when a bomb is planted.
 */
export interface BombPlantedEvent extends GameEvent {
	event: "BombPlanted";
	/** Planter client index. */
	client: number;
	/** Bomb site: "A" or "B". */
	site: string;
}

/**
 * Emitted when a bomb is defused.
 */
export interface BombDefusedEvent extends GameEvent {
	event: "BombDefused";
	/** Defuser client index. */
	client: number;
	/** Bomb site: "A" or "B". */
	site: string;
}

/**
 * Emitted when a bomb explodes.
 */
export interface BombExplodedEvent extends GameEvent {
	event: "BombExploded";
	/** Planter client index. */
	client: number;
	/** Bomb site: "A" or "B". */
	site: string;
}

/**
 * Emitted when a hostage is rescued.
 */
export interface HostageRescuedEvent extends GameEvent {
	event: "HostageRescued";
	client: number;
	hostage: number;
}

/**
 * Emitted when a player picks up an item.
 */
export interface ItemPickupEvent extends GameEvent {
	event: "ItemPickup";
	client: number;
	item: string;
}

/**
 * Emitted at the start of each round.
 */
export interface RoundStartEvent extends GameEvent {
	event: "RoundStart";
	timelimit: number;
	fraglimit: number;
}

/**
 * Emitted at the end of each round.
 */
export interface RoundEndEvent extends GameEvent {
	event: "RoundEnd";
	/** Winning team index. */
	winner: number;
	/** Round end reason code. */
	reason: number;
}

/**
 * Emitted when a new map session starts.
 */
export interface MapStartEvent extends GameEvent {
	event: "MapStart";
	map: string;
}

/**
 * Emitted when a map session ends.
 */
export interface MapEndEvent extends GameEvent {
	event: "MapEnd";
}

/**
 * Emitted every game tick (128 times per second) by the MetaBun tickrate loop.
 */
export interface GameFrameEvent extends GameEvent {
	event: "GameFrame";
	/** Current tick counter since server start. */
	tick: number;
	/** Simulated engine time in seconds (tick / 128). */
	time: number;
}
