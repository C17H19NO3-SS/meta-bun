import {
	BasePlugin,
	CreateConVar,
	GetCurrentMap,
	Hook,
	PrintToChat,
	players,
} from "meta-bun/core";
import type { ConVar } from "meta-bun/shared/types/bridge";
import type {
	MapStartEvent,
	PlayerDeathEvent,
} from "meta-bun/shared/types/events";

/**
 * SurfHPReward Plugin
 *
 * Automatically grants HP to the attacker upon a successful kill.
 * Logic is restricted to maps containing "surf_" in their name.
 */
export default class SurfHPReward extends BasePlugin {
	public override name = "Surf HP Reward";
	public override version = "1.0.0";
	public override author = "MetaBun Team";

	private hpRewardCvar!: ConVar;
	private maxHpCvar!: ConVar;
	private isActive = false;

	/**
	 * Called when the plugin is loaded.
	 */
	public override OnLoad(): void {
		// Register ConVars
		this.hpRewardCvar = CreateConVar(
			"sm_surf_hp_reward",
			"25",
			"HP amount granted on kill in surf maps.",
		);
		this.maxHpCvar = CreateConVar(
			"sm_surf_max_hp",
			"150",
			"Maximum HP a player can reach via rewards.",
		);

		this.CheckMap();
	}

	/**
	 * Listen for map start to re-verify if logic should be active.
	 */
	@Hook("MapStart")
	public override OnMapStart(data: MapStartEvent): void {
		console.log(`[Surf HP Reward] Map started: ${data.map}`);
		this.CheckMap();
	}

	/**
	 * Core logic: Reward HP when a player dies.
	 */
	@Hook("PlayerDeath")
	public override OnPlayerDeath(data: PlayerDeathEvent): void {
		if (!this.isActive) return;

		const attackerIndex = data.attacker;
		const victimIndex = data.client;

		// Index 0 means world/console kill, ignore
		if (attackerIndex <= 0 || attackerIndex === victimIndex) return;

		const attacker = players.Get(attackerIndex);
		if (!attacker?.IsAlive()) return;

		const rewardAmount = this.hpRewardCvar.GetInt();
		const maxHp = this.maxHpCvar.GetInt();

		const currentHp = attacker.GetHealth();
		let newHp = currentHp + rewardAmount;

		if (newHp > maxHp) {
			newHp = maxHp;
		}

		if (newHp > currentHp) {
			attacker.SetHealth(newHp);
			attacker.PrintHintText(`HP Ödülü: +${rewardAmount} HP kazandın!`);
			PrintToChat(
				attackerIndex,
				`{Green}[Surf]{Default} Adam vurduğun için {Lime}+${rewardAmount} HP{Default} kazandın!`,
			);
		}
	}

	/**
	 * Helper to check if current map is a surf map.
	 */
	private CheckMap(): void {
		const mapName = GetCurrentMap().toLowerCase();
		if (mapName.includes("surf_")) {
			this.isActive = true;
			console.log(
				"[Surf HP Reward] Surf map detected. Plugin logic is now ACTIVE.",
			);
		} else {
			this.isActive = false;
			console.log(
				`[Surf HP Reward] Non-surf map (${mapName}) detected. Plugin logic is INACTIVE.`,
			);
		}
	}
}
