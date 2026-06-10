export function SteamIdTo64(steamId: string): string | null {
	if (!steamId || steamId === "STEAM_ID_LAN" || steamId === "BOT") return null;

	// Check for Steam3 format: [U:1:account_id]
	const steam3Parts = steamId.match(/^\[U:\d+:(\d+)\]$/);
	if (steam3Parts) {
		const accountId = BigInt(steam3Parts[1]!);
		const communityId = accountId + BigInt(76561197960265728);
		return communityId.toString();
	}

	const parts = steamId.match(/^STEAM_(\d+):(\d+):(\d+)$/);
	if (!parts) {
		if (steamId.length === 17 && steamId.startsWith("7656")) return steamId;
		return null;
	}
	const y = BigInt(parts[2]!);
	const z = BigInt(parts[3]!);
	const communityId = z * BigInt(2) + y + BigInt(76561197960265728);
	return communityId.toString();
}
