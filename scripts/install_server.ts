import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * PRODUCTION INSTALLER / UPDATER
 *
 * This script is intended to run on the game server (inside the container).
 * It pulls the latest release from GitHub and installs it to the target directory.
 */

const REPO = "C17H19NO3-SS/meta-bun";
const NPM_PACKAGE = "@meta-bun/core";
const INSTALL_PATH = Bun.env["CS2_PATH"] || "/server/game/csgo";

// ... (existing code)

async function _updateViaNPM() {
	console.log(`\n\x1b[33m[1/2] Updating via NPM (${NPM_PACKAGE})...\x1b[0m`);
	await run("bun", ["install", `${NPM_PACKAGE}@latest`]);

	console.log("\n\x1b[33m[2/2] Symlinking/Copying files to addons...");
	// NPM paketi içindeki dist dosyalarını addons dizinine bağlar veya kopyalar
}

async function run(
	command: string,
	args: string[],
	cwd: string = ".",
): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { stdio: "inherit", cwd });
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
		});
	});
}

async function getLatestRelease() {
	console.log(`[Installer] Fetching latest release info for ${REPO}...`);
	const response = await fetch(
		`https://api.github.com/repos/${REPO}/releases/latest`,
	);
	if (!response.ok) throw new Error("Failed to fetch release info");
	return await response.json();
}

async function main() {
	console.log(`\x1b[35m${"=".repeat(60)}`);
	console.log("             METABUN PRODUCTION INSTALLER");
	console.log(`${"=".repeat(60)}\x1b[0m`);

	try {
		if (!existsSync(INSTALL_PATH)) {
			console.error(
				`\x1b[31mError: Target path ${INSTALL_PATH} does not exist!\x1b[0m`,
			);
			console.log("Please set CS2_PATH environment variable.");
			process.exit(1);
		}

		const release = await getLatestRelease();
		const asset = release.assets.find((a: any) => a.name.endsWith(".zip"));

		if (!asset) {
			throw new Error("No .zip asset found in the latest release!");
		}

		const downloadUrl = asset.browser_download_url;
		const tmpFile = "/tmp/meta-bun-update.zip";
		const tmpExtractDir = "/tmp/meta-bun-extract";

		// 1. Download
		console.log(`\n\x1b[33m[1/4] Downloading ${release.tag_name}...\x1b[0m`);
		await run("curl", ["-L", "-o", tmpFile, downloadUrl]);

		// 2. Extract
		console.log("\n\x1b[33m[2/4] Extracting archive...\x1b[0m");
		if (existsSync(tmpExtractDir)) rmSync(tmpExtractDir, { recursive: true });
		mkdirSync(tmpExtractDir);
		await run("unzip", ["-o", tmpFile, "-d", tmpExtractDir]);

		// 3. Backup Configs & Plugins
		console.log(
			"\n\x1b[33m[3/4] Preparing update (backing up configs/plugins)...\x1b[0m",
		);
		const metaBunPath = join(INSTALL_PATH, "addons", "meta-bun");
		const backupDir = `/tmp/metabun-backup-${Date.now()}`;

		if (existsSync(metaBunPath)) {
			mkdirSync(backupDir, { recursive: true });
			for (const dir of ["configs", "plugins"]) {
				const src = join(metaBunPath, dir);
				if (existsSync(src)) {
					console.log(`Backing up ${dir}...`);
					await run("cp", ["-r", src, join(backupDir, dir)]);
				}
			}
		}

		// 4. Install / Overwrite
		console.log("\n\x1b[33m[4/4] Installing update to game server...\x1b[0m");
		// Copy addons folder from extraction
		const extractedAddons = join(tmpExtractDir, "addons");
		await run("cp", ["-rv", extractedAddons, INSTALL_PATH]);

		// Restore backups if they exist (don't overwrite new system files, just merge user data)
		if (existsSync(backupDir)) {
			console.log("Restoring your configs and plugins...");
			await run("cp", ["-rv", `${backupDir}/.`, metaBunPath]);
		}

		// Cleanup
		rmSync(tmpFile);
		rmSync(tmpExtractDir, { recursive: true });
		rmSync(backupDir, { recursive: true });

		console.log(`\n\x1b[32m${"=".repeat(60)}`);
		console.log(
			`   SUCCESS: MetaBun ${release.tag_name} installed to ${INSTALL_PATH}`,
		);
		console.log("   Restart your CS2 server to apply changes.");
		console.log(`${"=".repeat(60)}\x1b[0m`);
	} catch (error: any) {
		console.error(`\n\x1b[31mInstallation Failed: ${error.message}\x1b[0m`);
		process.exit(1);
	}
}

main().catch(console.error);
