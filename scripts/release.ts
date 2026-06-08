import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

async function run(cmd: string, args: string[], cwd?: string): Promise<string> {
	return new Promise((resolve, reject) => {
		console.log(`\x1b[90m> ${cmd} ${args.join(" ")}\x1b[0m`);
		const proc = spawn(cmd, args, { stdio: "pipe", shell: true, cwd });
		let output = "";

		proc.stdout.on("data", (data) => {
			output += data.toString();
			process.stdout.write(data);
		});
		proc.stderr.on("data", (data) => {
			process.stderr.write(data);
		});

		proc.on("close", (code) => {
			if (code === 0) resolve(output.trim());
			else reject(new Error(`Command failed with exit code ${code}`));
		});
	});
}

async function checkDependencies() {
	try {
		await run("gh", ["--version"]);
	} catch (_e) {
		console.error(
			"\x1b[31mError: GitHub CLI (gh) is not installed or not in PATH.\x1b[0m",
		);
		console.error(
			"Please install it from: https://cli.github.com/ and run 'gh auth login'.",
		);
		process.exit(1);
	}

	try {
		await run("zip", ["--version"]);
	} catch (_e) {
		console.error("\x1b[31mError: 'zip' command is not installed.\x1b[0m");
		console.error("Please install zip (e.g., apt install zip).");
		process.exit(1);
	}
}

async function main() {
	const args = process.argv.slice(2);
	let newVersion = args[0];

	if (!newVersion) {
		console.error("\x1b[31mError: Please provide a version number.\x1b[0m");
		console.error("Usage: bun run release 1.1.0");
		process.exit(1);
	}

	if (!newVersion.startsWith("v")) {
		newVersion = `v${newVersion}`;
	}

	const versionNumber = newVersion.substring(1);

	console.log(`\x1b[35m${"=".repeat(60)}\x1b[0m`);
	console.log(`             METABUN LOCAL RELEASE MANAGER (${newVersion})`);
	console.log(`\x1b[35m${"=".repeat(60)}\x1b[0m`);

	await checkDependencies();

	try {
		// 1. Update package.json version
		console.log("\n\x1b[36m[1/6] Updating package.json version...\x1b[0m");
		const pkgPath = join(process.cwd(), "package.json");
		const pkgContent = JSON.parse(readFileSync(pkgPath, "utf-8"));
		pkgContent.version = versionNumber;
		writeFileSync(pkgPath, `${JSON.stringify(pkgContent, null, 2)}\n`);
		await run("bunx", ["@biomejs/biome", "format", "--write", "package.json"]);

		// 2. Build the project
		console.log("\n\x1b[36m[2/6] Building project (C++ & TS)...\x1b[0m");
		await run("bun", ["run", "build"]);

		// 3. Create ZIP archive
		console.log("\n\x1b[36m[3/6] Packaging release ZIP...\x1b[0m");
		const zipName = `meta-bun-${newVersion}.zip`;
		const distDir = join(process.cwd(), "dist");
		if (!existsSync(distDir)) {
			throw new Error("dist directory not found. Build must have failed.");
		}
		await run("zip", ["-r", `../${zipName}`, "addons/"], distDir);

		// 4. Git Commit and Tag
		console.log(
			"\n\x1b[36m[4/6] Committing changes and creating Git tag...\x1b[0m",
		);
		await run("git", ["add", "package.json"]);
		await run("git", ["commit", "-m", `chore: release ${newVersion}`]);
		await run("git", ["tag", "-a", newVersion, "-m", `Release ${newVersion}`]);

		// 5. Push to GitHub
		console.log("\n\x1b[36m[5/6] Pushing to GitHub...\x1b[0m");
		await run("git", ["push", "origin", "master"]);
		await run("git", ["push", "origin", newVersion]);

		// 6. Create GitHub Release using gh CLI
		console.log(
			"\n\x1b[36m[6/6] Creating GitHub Release & Uploading Asset...\x1b[0m",
		);
		const releaseNotes = `## 📦 Installation\n\n1. Download \`${zipName}\`\n2. Extract and copy the \`addons/\` folder into your CS2 server's \`game/csgo/\` directory\n3. Restart your server\n\n## 📋 Requirements\n\n- CS2 Dedicated Server with [Metamod:Source](https://www.sourcemm.net/) installed\n- No additional runtime required — Bun is bundled\n\n*(Note: Check CHANGELOG.md for full details)*`;

		await run("gh", [
			"release",
			"create",
			newVersion,
			zipName,
			"--title",
			`MetaBun ${newVersion}`,
			"--notes",
			releaseNotes,
		]);

		console.log(`\n\x1b[32m${"=".repeat(60)}\x1b[0m`);
		console.log(
			`   SUCCESS: Release ${newVersion} has been published to GitHub!`,
		);
		console.log(`\x1b[32m${"=".repeat(60)}\x1b[0m`);
	} catch (error: any) {
		console.error(`\n\x1b[31mRelease Failed: ${error.message}\x1b[0m`);
		process.exit(1);
	}
}

main();
