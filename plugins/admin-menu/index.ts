import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	BasePlugin,
	Command,
	CreateMenu,
	LogAdminAction,
	PrintToChat,
	ReplyToCommand,
	players,
	SlapPlayer,
	KickClient,
	BanClient,
	RespawnPlayer,
	ChangeClientTeam,
	ServerCommand,
	GetClientName,
	GetClientAuthId,
	ProcessTargetString,
	CanAdminTarget,
	SetEntityMoveType,
	SetEntityHealth,
	PrintHintText,
	PrintToChatAll,
	GetState,
	SetState,
	GetCmdReplySource,
	ReplySource,
	CreateTimer,
} from "meta-bun/core";

const ALIASES_FILE = join(process.cwd(), "configs", "core", "map_aliases.json");

export default class AdminMenuPlugin extends BasePlugin {
	public override name = "Admin Menu";
	public override version = "1.0.5";
	public override author = "MetaBun Team";

	public override OnLoad(): void {
		const saved = this.LoadAliases();
		if (Object.keys(saved).length > 0) {
			SetState("map_aliases", saved);
		}
	}

	private activeActions = new Map<number, string>();
	private noclipState = new Map<number, boolean>();
	private godState = new Map<number, boolean>();

	private defaultMaps = [
		"de_ancient",
		"de_anubis",
		"de_dust2",
		"de_inferno",
		"de_mirage",
		"de_nuke",
		"de_overpass",
		"de_vertigo",
		"cs_italy",
		"cs_office",
	];

	private GetKnownMaps(): string[] {
		const aliases = GetState<Record<string, string>>("map_aliases", {});
		return [...this.defaultMaps, ...Object.keys(aliases)].sort();
	}

	private SaveAliases(aliases: Record<string, string>): void {
		try {
			const dir = join(process.cwd(), "configs", "core");
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2));
		} catch (e) {
			console.error("[Admin Menu] Failed to save aliases:", e);
		}
	}

	private LoadAliases(): Record<string, string> {
		if (existsSync(ALIASES_FILE)) {
			try {
				const content = readFileSync(ALIASES_FILE, "utf-8");
				return JSON.parse(content);
			} catch (e) {
				console.error("[Admin Menu] Failed to load aliases:", e);
			}
		}
		return {};
	}

	@Command("sm_admin", "b", "Opens the main admin menu")
	public OnAdminCommand(client: number, _args: string[]): void {
		if (client === 0) {
			ReplyToCommand(client, "{White}Konsol üzerinden kullanabileceğiniz komutlar:");
			ReplyToCommand(client, " - sm_kick <hedef> [sebep]");
			ReplyToCommand(client, " - sm_ban <hedef> <dakika> [sebep]");
			ReplyToCommand(client, " - sm_slay <hedef>");
			ReplyToCommand(client, " - sm_slap <hedef> [hasar]");
			ReplyToCommand(client, " - sm_respawn <hedef>");
			ReplyToCommand(client, " - sm_team <hedef> <takım (2:T, 3:CT)>");
			ReplyToCommand(client, " - sm_mute/sm_unmute <hedef>");
			ReplyToCommand(client, " - sm_gag/sm_ungag <hedef>");
			ReplyToCommand(client, " - sm_noclip <hedef>");
			ReplyToCommand(client, " - sm_who [hedef]");
			ReplyToCommand(client, " - sm_admins");
			ReplyToCommand(client, " - sm_wsmap <workshop_id>");
			ReplyToCommand(client, " - sm_mapalias <workshop_id> <isim>");
			return;
		}
		this.DisplayMainMenu(client);
	}

	@Command("sm_who", "b", "Displays admin status of players")
	public Command_Who(client: number, args: string[]): void {
		if (args.length === 0) {
			const p = players.Get(client);
			if (p) {
				const flags = p.GetAdminFlags() || "Yok";
				const immunity = p.GetAdminImmunity();
				ReplyToCommand(
					client,
					`{Yellow}Yetkileriniz: {Lime}${flags} {Default}(Immunity: ${immunity})`,
				);
			}
			return;
		}

		const targets = ProcessTargetString(client, args[0]!);
		if (targets.length === 0) {
			ReplyToCommand(client, "{Red}[MetaBun]{Default} Hedef bulunamadı.");
			return;
		}

		ReplyToCommand(client, "{Yellow}--- Hedef Oyuncular ve Yetkileri ---");
		for (const target of targets) {
			const p = players.Get(target);
			if (p) {
				const flags = p.GetAdminFlags() || "Yok";
				const immunity = p.GetAdminImmunity();
				ReplyToCommand(
					client,
					`{Default}[${p.index}] {Green}${p.name} {Default}(${p.steamId}) - Yetki: {Lime}${flags} {Default}(Immunity: ${immunity})`,
				);
			}
		}
	}

	@Command("sm_admins", "b", "Lists active admins in game")
	public Command_Admins(client: number, _args: string[]): void {
		const allPlayers = players.GetInGameClients();
		const activeAdmins = allPlayers.filter((p) => p.GetAdminFlags() !== "");

		ReplyToCommand(
			client,
			`{Yellow}--- Aktif Adminler (${activeAdmins.length}) ---`,
		);
		for (const p of activeAdmins) {
			const flags = p.GetAdminFlags();
			ReplyToCommand(
				client,
				`{Default}[${p.index}] {Green}${p.name} {Default}- Yetki: {Lime}${flags}`,
			);
		}
	}

	@Command("sm_kick", "c", "Kicks a player")
	public Command_Kick(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_kick <hedef> [sebep]");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		const reason = args.slice(1).join(" ") || "Yönetici tarafından atıldınız.";

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const targetName = GetClientName(target);
			KickClient(target, reason);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${targetName}{Default} oyuncusunu sunucudan attı.`);
			LogAdminAction(client, target, `kicked (Reason: ${reason})`);
		}
	}

	@Command("sm_slap", "c", "Slaps a player")
	public Command_Slap(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_slap <hedef> [hasar]");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		const damage = parseInt(args[1] || "0", 10);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			SlapPlayer(target, damage);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${GetClientName(target)}{Default} oyuncusunu tokatladı (${damage} HP).`);
			LogAdminAction(client, target, `slapped with ${damage} damage`);
		}
	}

	@Command("sm_slay", "c", "Slays a player")
	public Command_Slay(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_slay <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			SetEntityHealth(target, 0);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${GetClientName(target)}{Default} oyuncusunu öldürdü.`);
			LogAdminAction(client, target, "slayed");
		}
	}

	@Command("sm_respawn", "c", "Respawns a player")
	public Command_Respawn(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_respawn <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			RespawnPlayer(target);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${GetClientName(target)}{Default} oyuncusunu yeniden canlandırdı.`);
			LogAdminAction(client, target, "respawned");
		}
	}

	@Command("sm_team", "c", "Changes a player's team")
	public Command_Team(client: number, args: string[]): void {
		if (args.length < 2) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_team <hedef> <2|3>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		const team = parseInt(args[1]!, 10);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			ChangeClientTeam(target, team);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${GetClientName(target)}{Default} oyuncusunun takımını değiştirdi (${team === 2 ? "T" : "CT"}).`);
			LogAdminAction(client, target, `changed team to ${team}`);
		}
	}

	@Command("sm_ban", "d", "Bans a player")
	public Command_Ban(client: number, args: string[]): void {
		if (args.length < 2) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_ban <hedef> <dakika> [sebep]");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		const duration = parseInt(args[1]!, 10);
		const reason = args.slice(2).join(" ") || "Yönetici Yasaklaması";

		const adminAuth = GetClientAuthId(client);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const targetPlayer = players.Get(target);
			const targetName = GetClientName(target);

			if (targetPlayer?.IsBot()) {
				KickClient(target, "Bots cannot be banned, kicking instead.");
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${targetName}{Default} botunu sunucudan attı (Ban yerine).`);
				continue;
			}

			const targetAuth = GetClientAuthId(target);
			const targetNameReal = GetClientName(target);

			BanClient(targetAuth, reason, adminAuth, duration);
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${targetNameReal}{Default} oyuncusunu yasakladı (${duration === 0 ? "Kalıcı" : duration + " dk"}).`);
			LogAdminAction(client, target, `banned for ${duration} mins (Reason: ${reason})`);
		}
	}

	@Command("sm_mute", "c", "Mutes a player")
	public Command_Mute(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_mute <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const p = players.Get(target);
			if (p) {
				p.Mute();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${p.name}{Default} oyuncusunu susturdu.`);
				LogAdminAction(client, target, "muted");
			}
		}
	}

	@Command("sm_unmute", "c", "Unmutes a player")
	public Command_Unmute(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_unmute <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const p = players.Get(target);
			if (p) {
				p.Unmute();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${p.name}{Default} oyuncusunun susturmasını açtı.`);
				LogAdminAction(client, target, "unmuted");
			}
		}
	}

	@Command("sm_gag", "c", "Gags a player")
	public Command_Gag(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_gag <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const p = players.Get(target);
			if (p) {
				p.Gag();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${p.name}{Default} oyuncusunun sohbetini kapattı (Gag).`);
				LogAdminAction(client, target, "gagged");
			}
		}
	}

	@Command("sm_ungag", "c", "Ungags a player")
	public Command_Ungag(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_ungag <hedef>");
			return;
		}
		const targets = ProcessTargetString(client, args[0]!);
		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const p = players.Get(target);
			if (p) {
				p.Ungag();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default}, {Yellow}${p.name}{Default} oyuncusunun sohbet engelini kaldırdı.`);
				LogAdminAction(client, target, "ungagged");
			}
		}
	}

	@Command("sm_noclip", "d", "Toggles noclip for a player")
	public Command_Noclip(client: number, args: string[]): void {
		if (args.length < 1 && client === 0) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_noclip <hedef>");
			return;
		}
		const targetStr = args[0] || "@me";
		const targets = ProcessTargetString(client, targetStr);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const currentState = this.noclipState.get(target) || false;
			const newState = !currentState;
			this.noclipState.set(target, newState);

			// 8 = MOVETYPE_NOCLIP, 2 = MOVETYPE_WALK
			SetEntityMoveType(target, newState ? 8 : 2);

			const targetName = GetClientName(target);
			ReplyToCommand(client, `{Green}${targetName}{Default} için Noclip: ${newState ? "{Lime}Açık" : "{Red}Kapalı"}`);
			LogAdminAction(client, target, `toggled noclip to ${newState}`);
		}
	}

	@Command("sm_god", "d", "Toggles god mode for a player")
	public Command_God(client: number, args: string[]): void {
		const targetStr = args[0] || "@me";
		const targets = ProcessTargetString(client, targetStr);

		for (const target of targets) {
			if (!CanAdminTarget(client, target)) continue;
			const currentState = this.godState.get(target) || false;
			const newState = !currentState;
			this.godState.set(target, newState);

			if (newState) {
				SetEntityHealth(target, 999999);
			} else {
				SetEntityHealth(target, 100);
			}

			const targetName = GetClientName(target);
			ReplyToCommand(client, `{Green}${targetName}{Default} için God Mode: ${newState ? "{Lime}Açık" : "{Red}Kapalı"}`);
			LogAdminAction(client, target, `toggled god mode to ${newState}`);
		}
	}

	@Command("sm_cvar", "g", "View or modify a console variable")
	public async Command_CVar(client: number, args: string[]): Promise<void> {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_cvar <cvar> [değer]");
			return;
		}

		const cvarName = args[0]!;
		const localCvar = this.FindConVar(cvarName);

		if (args.length === 1) {
			// Query
			let value: string | null = null;
			if (localCvar) {
				value = localCvar.GetString();
			} else {
				value = await this.QueryConVar(cvarName);
			}

			if (value === null) {
				ReplyToCommand(client, `{Red}[MetaBun]{White} CVar bulunamadı: {Yellow}${cvarName}`);
			} else {
				ReplyToCommand(client, `{Green}[MetaBun]{Default} {Yellow}"${cvarName}"{Default} değeri: {Lime}"${value}"`);
			}
		} else {
			// Set
			const newValue = args.slice(1).join(" ");
			if (localCvar) {
				localCvar.SetString(newValue);
			} else {
				// Send direct server command for engine cvars
				this.ServerCommand(`${cvarName} "${newValue}"`);
			}
			ReplyToCommand(client, `{Green}[MetaBun]{Default} {Yellow}"${cvarName}"{Default} yeni değeri: {Lime}"${newValue}"`);
			LogAdminAction(client, null, `changed cvar ${cvarName} to ${newValue}`);
		}
	}

	@Command("sm_map", "g", "Changes the map")
	public Command_Map(client: number, args: string[]): void {
		if (args.length < 1) {
			const allMaps = this.GetKnownMaps();

			if (client === 0 || GetCmdReplySource() === ReplySource.Console) {
				ReplyToCommand(client, "{Yellow}--- Kullanılabilir Haritalar ---");
				const aliases = GetState<Record<string, string>>("map_aliases", {});
				for (const m of allMaps) {
					const isWorkshop = aliases[m] !== undefined;
					ReplyToCommand(client, ` - ${m}${isWorkshop ? " (Workshop)" : ""}`);
				}
				ReplyToCommand(client, "{White}Kullanım: sm_map <harita>");
				return;
			}
			this.DisplayMapMenu(client);
			return;
		}
		const mapInput = args[0]!.toLowerCase();
		this.ExecuteMapChange(client, mapInput);
	}

	private ExecuteMapChange(client: number, mapInput: string): void {
		const input = mapInput.toLowerCase();
		const aliases = GetState<Record<string, string>>("map_aliases", {});
		const allMapNames = this.GetKnownMaps();

		let targetMap = "";

		// 1. Exact match
		if (allMapNames.includes(input)) {
			targetMap = input;
		} else {
			// 2. Partial match
			const matches = allMapNames.filter((m) => m.toLowerCase().includes(input));
			if (matches.length > 0) {
				targetMap = matches[0]!;
				if (matches.length > 1) {
					ReplyToCommand(
						client,
						`{Red}[MetaBun]{Default} Birden fazla eşleşme bulundu, {Yellow}${targetMap}{Default} seçildi. (${matches.join(", ")})`,
					);
				}
			}
		}

		if (!targetMap) {
			ReplyToCommand(
				client,
				`{Red}[MetaBun]{White} Harita bulunamadı: {Yellow}${mapInput}`,
			);
			return;
		}

		// Check for aliases
		const workshopId = aliases[targetMap];

		if (workshopId) {
			PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default} alias üzerinden Workshop haritasını açıyor: {Yellow}${targetMap} (${workshopId})`);
			LogAdminAction(client, null, `changed map via alias ${targetMap} to ${workshopId}`);

			CreateTimer(3000, () => {
				ServerCommand(`host_workshop_map ${workshopId}`);
			});
			return;
		}

		PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default} haritayı değiştiriyor: {Yellow}${targetMap}`);
		LogAdminAction(client, null, `changed map to ${targetMap}`);

		CreateTimer(3000, () => {
			ServerCommand(`map ${targetMap}`);
		});
	}

	/**
	 * Map Selection Menu
	 */
	private DisplayMapMenu(client: number): void {
		const allMaps = this.GetKnownMaps();
		const aliases = GetState<Record<string, string>>("map_aliases", {});

		const menu = CreateMenu("Harita Seçin", (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}
			this.ExecuteMapChange(c, info);
		});

		for (const m of allMaps) {
			const isWorkshop = aliases[m] !== undefined;
			const label = isWorkshop ? `[WS] ${m}` : m;
			menu.AddItem(m, label);
		}

		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	@Command("sm_wsmap", "g", "Changes the map to a workshop map")
	public Command_WSMap(client: number, args: string[]): void {
		if (args.length < 1) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_wsmap <workshop_id>");
			return;
		}
		const workshopId = args[0]!;
		PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(client)}{Default} Workshop haritasını açıyor: {Yellow}${workshopId}`);
		LogAdminAction(client, null, `changed workshop map to ${workshopId}`);

		CreateTimer(3000, () => {
			ServerCommand(`host_workshop_map ${workshopId}`);
		});
	}

	@Command("sm_mapalias", "g", "Creates an alias for a workshop map")
	public Command_MapAlias(client: number, args: string[]): void {
		if (args.length < 2) {
			ReplyToCommand(client, "{Red}[MetaBun]{White} Kullanım: sm_mapalias <workshop_id> <isim>");
			return;
		}
		const workshopId = args[0]!;
		const aliasName = args[1]!.toLowerCase();

		const aliases = GetState<Record<string, string>>("map_aliases", {});
		aliases[aliasName] = workshopId;
		SetState("map_aliases", aliases);
		this.SaveAliases(aliases);

		ReplyToCommand(client, `{Green}[MetaBun]{Default} Alias oluşturuldu: {Yellow}${aliasName} {Default}-> {Yellow}${workshopId}`);
		LogAdminAction(client, null, `created map alias: ${aliasName} -> ${workshopId}`);
	}

	@Command("sm_say", "i", "Sends a message to all players")
	public Command_Say(_client: number, args: string[]): void {
		if (args.length < 1) return;
		const message = args.join(" ");
		PrintToChatAll(`{Red}(ADMIN) {Green}${GetClientName(_client)}{Default}: ${message}`);
	}

	@Command("sm_hsay", "i", "Sends a hint message to all players")
	public Command_HSay(_client: number, args: string[]): void {
		if (args.length < 1) return;
		const message = args.join(" ");
		for (const p of players.GetInGameClients()) {
			PrintHintText(p.index, message);
		}
	}

	/**
	 * Main Category Menu
	 */
	private DisplayMainMenu(client: number): void {
		const menu = CreateMenu("Yönetici Menüsü", (c, info) => {
			if (info === "player_actions") this.DisplayPlayerActionsMenu(c);
			else if (info === "comm_actions") this.DisplayCommActionsMenu(c);
			else if (info === "fun_actions") this.DisplayFunActionsMenu(c);
			else if (info === "server_actions") this.DisplayServerActionsMenu(c);
		});

		menu.AddItem("player_actions", "Oyuncu İşlemleri");
		menu.AddItem("comm_actions", "İletişim İşlemleri");
		menu.AddItem("fun_actions", "Eğlence / Araçlar");
		menu.AddItem("server_actions", "Sunucu İşlemleri");
		menu.Display(client);
	}

	/**
	 * Player Actions Selection Menu
	 */
	private DisplayPlayerActionsMenu(client: number): void {
		const menu = CreateMenu("Oyuncu İşlemleri", (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}
			this.activeActions.set(c, info);
			this.DisplayPlayerTargetMenu(c, info);
		});

		menu.AddItem("slay", "Öldür (Slay)");
		menu.AddItem("kick", "At (Kick)");
		menu.AddItem("ban", "Yasakla (Ban)");
		menu.AddItem("respawn", "Yeniden Canlandır");
		menu.AddItem("team_swap", "Takım Değiştir");

		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	/**
	 * Communication Actions Selection Menu
	 */
	private DisplayCommActionsMenu(client: number): void {
		const menu = CreateMenu("İletişim İşlemleri", (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}
			this.activeActions.set(c, info);
			this.DisplayPlayerTargetMenu(c, info);
		});

		menu.AddItem("mute", "Sustur (Mute)");
		menu.AddItem("unmute", "Susturmayı Aç");
		menu.AddItem("gag", "Chat Kapat (Gag)");
		menu.AddItem("ungag", "Chat Aç");
		menu.AddItem("silence", "Tam Sessizlik");

		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	/**
	 * Fun Actions Selection Menu
	 */
	private DisplayFunActionsMenu(client: number): void {
		const menu = CreateMenu("Eğlence / Araçlar", (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}
			this.activeActions.set(c, info);
			this.DisplayPlayerTargetMenu(c, info);
		});

		menu.AddItem("slap", "Tokatla (Slap)");
		menu.AddItem("noclip", "Noclip (Uçuş)");
		menu.AddItem("god", "God Mode (Ölümsüzlük)");
		menu.AddItem("hp100", "Canını Yenile (100 HP)");

		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	/**
	 * Server Actions Selection Menu
	 */
	private DisplayServerActionsMenu(client: number): void {
		const menu = CreateMenu("Sunucu İşlemleri", (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}

			if (info === "restart") {
				ServerCommand("mp_restartgame 1");
				PrintToChat(0, "{Red}[MetaBun]{Default} Sunucu yönetici tarafından yeniden başlatıldı.");
				LogAdminAction(c, null, "restarted the round (mp_restartgame 1)");
			}
		});

		menu.AddItem("restart", "Raundu Yeniden Başlat");
		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	/**
	 * Dynamic Player List for target selection
	 */
	private DisplayPlayerTargetMenu(client: number, action: string): void {
		const actionNames: Record<string, string> = {
			slap: "Tokatla",
			slay: "Öldür",
			kick: "At",
			ban: "Yasakla",
			respawn: "Canlandır",
			team_swap: "Takım Değiştir",
			mute: "Sustur",
			unmute: "Susturma Aç",
			gag: "Gagla",
			ungag: "Gag Aç",
			silence: "Sessize Al",
			noclip: "Noclip",
			god: "God Mode",
			hp100: "Heal",
		};

		const title = `${actionNames[action] || "Oyuncu"} Seçin`;
		const menu = CreateMenu(title, (c, info) => {
			if (info === "__back__") {
				this.DisplayMainMenu(c);
				return;
			}

			const targetIndex = parseInt(info, 10);
			this.ExecutePlayerAction(c, targetIndex, action);
		});

		const allPlayers = players.GetInGameClients();
		for (const p of allPlayers) {
			const label = p.IsBot() ? `[BOT] ${p.name}` : p.name;
			menu.AddItem(p.index.toString(), label);
		}

		menu.AddItem("__back__", "<- Geri");
		menu.Display(client);
	}

	/**
	 * Logic Execution for selected action and target (Menu Version)
	 */
	private ExecutePlayerAction(admin: number, target: number, action: string): void {
		if (!players.Get(target)) {
			PrintToChat(admin, "{Red}[MetaBun]{Default} Hedef oyuncu artık sunucuda değil.");
			return;
		}

		// Check immunity
		if (!CanAdminTarget(admin, target)) {
			PrintToChat(admin, "{Red}[MetaBun]{Default} Bu oyuncuya işlem yapmak için yetkiniz yetersiz.");
			return;
		}

		const p = players.Get(target)!;
		const targetName = GetClientName(target);

		switch (action) {
			case "slap":
				SlapPlayer(target, 0);
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu tokatladı.`);
				LogAdminAction(admin, target, "slapped (menu)");
				break;
			case "slay":
				SetEntityHealth(target, 0);
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu öldürdü.`);
				LogAdminAction(admin, target, "slayed (menu)");
				break;
			case "kick":
				KickClient(target, "Yönetici tarafından sunucudan atıldınız.");
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu sunucudan attı.`);
				LogAdminAction(admin, target, "kicked (menu)");
				break;
			case "ban":
				if (p.IsBot()) {
					KickClient(target, "Bots cannot be banned, kicking instead.");
					PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} botunu sunucudan attı (Ban yerine).`);
					LogAdminAction(admin, target, "kicked (menu - attempted ban)");
					break;
				}
				const adminSteamId = GetClientAuthId(admin);
				const targetSteamId = GetClientAuthId(target);
				BanClient(targetSteamId, "Yönetici Yasaklaması", adminSteamId, 0);
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu kalıcı olarak yasakladı.`);
				LogAdminAction(admin, target, "banned (menu)");
				break;
			case "respawn":
				RespawnPlayer(target);
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu yeniden canlandırdı.`);
				LogAdminAction(admin, target, "respawned (menu)");
				break;
			case "team_swap":
				const currentTeam = p.GetTeam();
				const newTeam = currentTeam === 2 ? 3 : 2;
				ChangeClientTeam(target, newTeam);
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunun takımını değiştirdi.`);
				LogAdminAction(admin, target, `team swap to ${newTeam} (menu)`);
				break;
			case "mute":
				p.Mute();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu susturdu.`);
				break;
			case "unmute":
				p.Unmute();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunun susturmasını açtı.`);
				break;
			case "gag":
				p.Gag();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu gagladı.`);
				break;
			case "ungag":
				p.Ungag();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunun gagını açtı.`);
				break;
			case "silence":
				p.Silence();
				PrintToChat(0, `{Red}[MetaBun]{Default} Admin {Green}${GetClientName(admin)}{Default}, {Yellow}${targetName}{Default} oyuncusunu tamamen sessize aldı.`);
				break;
			case "noclip":
				const cNoclip = this.noclipState.get(target) || false;
				this.noclipState.set(target, !cNoclip);
				SetEntityMoveType(target, !cNoclip ? 8 : 2);
				ReplyToCommand(admin, `{Green}${targetName}{Default} için Noclip ${!cNoclip ? "Açıldı" : "Kapatıldı"}.`);
				break;
			case "god":
				const cGod = this.godState.get(target) || false;
				this.godState.set(target, !cGod);
				SetEntityHealth(target, !cGod ? 999999 : 100);
				ReplyToCommand(admin, `{Green}${targetName}{Default} için God Mode ${!cGod ? "Açıldı" : "Kapatıldı"}.`);
				break;
			case "hp100":
				SetEntityHealth(target, 100);
				ReplyToCommand(admin, `{Green}${targetName}{Default} iyileştirildi.`);
				break;
		}

		if (action !== "kick" && action !== "ban") {
			this.DisplayPlayerTargetMenu(admin, action);
		} else {
			this.DisplayPlayerActionsMenu(admin);
		}
	}
}


