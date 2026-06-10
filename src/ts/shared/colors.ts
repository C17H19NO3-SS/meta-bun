/**
 * Central color mapping for MetaBun.
 * Maps human-readable tags to Source engine color codes and ANSI escape sequences.
 */

export const COLOR_MAP: Record<string, string> = {
	"{Default}": "\x01",
	"{White}": "\x01",
	"{Red}": "\x02",
	"{LightRed}": "\x03",
	"{Green}": "\x04",
	"{Lime}": "\x05",
	"{LightGreen}": "\x06",
	"{DarkRed}": "\x07",
	"{Grey}": "\x08",
	"{Yellow}": "\x09",
	"{Gold}": "\x0A",
	"{Blue}": "\x0B",
	"{DarkBlue}": "\x0C",
	"{Purple}": "\x0E",
	"{Magenta}": "\x0F",
	"{Orange}": "\x10",
	"{Cyan}": "\x10",
};

export const ANSI_COLOR_MAP: Record<string, string> = {
	"\x01": "\x1b[0m", // Default (Reset)
	"\x02": "\x1b[31m", // Red
	"\x03": "\x1b[91m", // Light Red
	"\x04": "\x1b[32m", // Green
	"\x05": "\x1b[92m", // Lime
	"\x06": "\x1b[92m", // Light Green
	"\x07": "\x1b[31m", // Dark Red
	"\x08": "\x1b[90m", // Grey
	"\x09": "\x1b[93m", // Yellow
	"\x0A": "\x1b[33m", // Gold
	"\x0B": "\x1b[34m", // Blue
	"\x0C": "\x1b[94m", // Dark Blue
	"\x0E": "\x1b[35m", // Purple
	"\x0F": "\x1b[95m", // Magenta
	"\x10": "\x1b[38;5;208m", // Orange/Cyan
};

/**
 * Format custom chat color tags into game color codes.
 *
 * @param message Chat message to format.
 */
export function FormatColorTags(message: string): string {
	if (!message) return message;
	let formatted = message;
	for (const [tag, code] of Object.entries(COLOR_MAP)) {
		formatted = formatted.replaceAll(tag, code);
	}
	return formatted;
}

/**
 * Converts game color codes to ANSI escape sequences for terminal display.
 * Used for local console logging.
 */
export function ToAnsi(message: string): string {
	if (!message) return message;
	let formatted = message;
	for (const [code, ansi] of Object.entries(ANSI_COLOR_MAP)) {
		formatted = formatted.replaceAll(code, ansi);
	}
	return `${formatted}\x1b[0m`; // Ensure reset at end
}
