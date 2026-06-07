import { writeFileSync } from "node:fs";
import { join } from "node:path";

async function fetchGlobalGeoIP() {
	console.log(
		"[GeoIP Global] Fetching comprehensive worldwide GeoIP CSV data...",
	);

	try {
		const response = await fetch(
			"https://raw.githubusercontent.com/sapics/ip-location-db/master/dbip-country/dbip-country-ipv4.csv",
		);

		if (!response.ok) {
			throw new Error(`Failed to fetch: ${response.statusText}`);
		}

		const csvText = await response.text();
		const lines = csvText.trim().split("\n");
		console.log(`[GeoIP Global] Processing ${lines.length} IP ranges.`);

		const countryNames: Record<string, string> = {
			TR: "Turkey",
			US: "United States",
			DE: "Germany",
			GB: "United Kingdom",
			FR: "France",
			RU: "Russia",
			CN: "China",
			BR: "Brazil",
			IN: "India",
			JP: "Japan",
			KR: "South Korea",
			IT: "Italy",
			ES: "Spain",
			CA: "Canada",
			AU: "Australia",
			NL: "Netherlands",
			PL: "Poland",
			UA: "Ukraine",
			RO: "Romania",
			AZ: "Azerbaijan",
			KZ: "Kazakhstan",
			UZ: "Uzbekistan",
			SE: "Sweden",
			NO: "Norway",
		};

		const geoData = [];
		for (const line of lines) {
			const [start, end, code] = line.split(",");
			if (start && end && code) {
				geoData.push({
					start,
					end,
					country: countryNames[code] || code,
				});
			}
		}

		const dbPath = join(process.cwd(), "configs", "core", "geoip.json");
		// Write in chunks or use a more memory-efficient way if data is huge
		// For dbip-country-ipv4, it's around 200k-300k lines, which is fine for memory (approx 30-50MB JSON)
		writeFileSync(dbPath, JSON.stringify(geoData), "utf-8");
		console.log(
			`[GeoIP Global] Successfully saved ${geoData.length} worldwide ranges to ${dbPath}.`,
		);
	} catch (error) {
		console.error("[GeoIP Global] Error updating database:", error);
		process.exit(1);
	}
}

fetchGlobalGeoIP();
