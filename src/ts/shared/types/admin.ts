/**
 * Interface for managing server admin permissions and immunities.
 */
export interface IAdminManager {
	/**
	 * Check if the admin with the specified SteamID has the given permission flag.
	 * The "z" flag represents root access and always returns true for any check.
	 *
	 * @param steamId SteamID of the admin to check.
	 * @param flag Permission flag to query (e.g. "a", "c", "z").
	 * @returns True if the permission exists, false otherwise.
	 */
	HasPermission(steamId: string, flag: string): boolean;

	/**
	 * Get all permission flags associated with the specified SteamID.
	 *
	 * @param steamId SteamID of the admin.
	 * @returns A string containing all assigned permission letters (e.g. "abc").
	 */
	GetFlags(steamId: string): string;

	/**
	 * Get the immunity level of the specified SteamID.
	 * Higher values protect admins from being targeted by other admins.
	 *
	 * @param steamId SteamID of the admin.
	 * @returns Immunity level (integer between 0 and 100).
	 */
	GetImmunity(steamId: string): number;

	/**
	 * Get all groups associated with the specified SteamID.
	 *
	 * @param steamId SteamID of the admin.
	 * @returns An array of group names.
	 */
	GetGroups(steamId: string): string[];

	/**
	 * Determine if an admin can target another admin/player based on immunity levels.
	 * The targeting admin's immunity level must be greater than or equal to the target's.
	 *
	 * @param adminSteamId SteamID of the admin performing the action.
	 * @param targetSteamId SteamID of the targeted player/admin.
	 * @returns True if targeting is allowed, false otherwise.
	 */
	CanTarget(adminSteamId: string, targetSteamId: string): boolean;

	/**
	 * Dynamically assign permission flags to a SteamID at runtime.
	 *
	 * @param steamId Target SteamID.
	 * @param flags Flag string to assign (e.g. "abc").
	 */
	SetFlags(steamId: string, flags: string): void;

	/**
	 * Dynamically set the immunity level of a SteamID at runtime.
	 *
	 * @param steamId Target SteamID.
	 * @param level Immunity level (0–99).
	 */
	SetImmunity(steamId: string, level: number): void;

	/**
	 * Reload admin configurations from the config file without restarting.
	 * Clears all existing flags and immunity data before reloading.
	 */
	ReloadAdmins(): void;

	/**
	 * Checks if there is a command override flag defined for a console command.
	 *
	 * @param command The command name (e.g. "sm_slap").
	 * @returns The override flags required, or undefined if no override is set.
	 */
	GetCommandOverride(command: string): string | undefined;

	/**
	 * Dynamically creates/saves a runtime admin.
	 */
	CreateAdmin(
		steamid: string,
		flags: string,
		immunity?: number,
		expiresAt?: number,
	): void;

	/**
	 * Dynamically removes a runtime admin.
	 */
	RemoveAdmin(steamid: string): void;

	/**
	 * Dynamically defines a runtime admin group.
	 */
	AddAdminGroup(
		groupName: string,
		flags: string,
		immunity?: number,
		inherit?: string,
	): void;

	/**
	 * Dynamically registers a command access flag override at runtime.
	 */
	AddCommandOverride(command: string, flags: string): void;

	/**
	 * Dynamically removes a command access override at runtime.
	 */
	RemoveCommandOverride(command: string): void;

	/**
	 * Logs an admin action in the database.
	 */
	LogAction(
		adminSteamId: string,
		adminName: string,
		targetSteamId: string,
		targetName: string,
		action: string,
	): void;
}
