import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Manager for multi-language string translations.
 */
export class TranslationManager {
	private translations: Map<string, Record<string, string>> = new Map();

	/**
	 * Loads a translation JSON file from the translations directory.
	 *
	 * @param lang The language code (e.g. "en", "tr").
	 */
	public LoadLanguage(lang: string): void {
		try {
			const base = (this as any).baseDir || join(process.cwd(), "translations");
			const path = join(base, `${lang}.json`);
			if (existsSync(path)) {
				const content = readFileSync(path, "utf-8");
				this.translations.set(lang, JSON.parse(content));
			}
		} catch (e) {
			console.error(`[TranslationManager] Error loading language ${lang}:`, e);
		}
	}

	/**
	 * Formats a translation string with arguments.
	 *
	 * @param text The translation template string.
	 * @param args Arguments to inject (replaces {0}, {1}, etc).
	 */
	public Format(text: string, ...args: unknown[]): string {
		let formatted = text;
		for (let i = 0; i < args.length; i++) {
			formatted = formatted.replaceAll(`{${i}}`, String(args[i]));
		}
		return formatted;
	}

	/**
	 * Loads a translation file for a plugin.
	 */
	public LoadTranslations(_filename: string): void {
		// Current implementation loads global languages,
		// but this could be expanded to load plugin-specific files.
		this.LoadLanguage("en");
		this.LoadLanguage("tr");
	}

	/**
	 * Gets a translation key for a plugin and language.
	 */
	public GetTranslation(
		_pluginName: string,
		key: string,
		lang: string,
	): string {
		return this.Translate(lang, key);
	}

	/**
	 * Translates a key for a given language.
	 *
	 * @param lang The target language code.
	 * @param key The translation key.
	 * @param args Optional arguments to format.
	 * @returns The translated and formatted string.
	 */
	public Translate(lang: string, key: string, ...args: unknown[]): string {
		const langSet = this.translations.get(lang) || this.translations.get("en");
		if (!langSet?.[key]) {
			return key;
		}
		return this.Format(langSet[key]!, ...args);
	}
}

export const translationManager = new TranslationManager();
