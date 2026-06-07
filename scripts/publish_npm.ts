import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * MANUAL NPM PUBLISH SCRIPT
 *
 * This script prepares the dist folder and publishes the package to NPM.
 * It ensures that the published package contains only the necessary files
 * and that the package.json is correctly configured for the consumer.
 */

async function run(
	command: string,
	args: string[],
	cwd: string = ".",
): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log(
			`\n\x1b[36m[NPM Publish] Executing: ${command} ${args.join(" ")}\x1b[0m`,
		);
		const proc = spawn(command, args, { stdio: "inherit", cwd });
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
		});
	});
}

async function main() {
	const root = resolve(import.meta.dir, "..");
	const distDir = join(root, "dist", "addons", "meta-bun");

	console.log(`\x1b[35m${"=".repeat(60)}`);
	console.log("             METABUN NPM PUBLICATION SYSTEM");
	console.log(`${"=".repeat(60)}\x1b[0m`);

	try {
		// 1. Build the project first to ensure dist is up to date
		console.log("\n\x1b[33m[1/4] Building project...\x1b[0m");
		await run("bun", ["run", "build"], root);

		if (!existsSync(distDir)) {
			throw new Error(
				`Dist directory not found at ${distDir}. Build might have failed.`,
			);
		}

		// 2. Copy essential files to dist
		console.log("\n\x1b[33m[2/4] Copying README and LICENSE to dist...\x1b[0m");
		const filesToCopy = ["README.md", "LICENSE", "LICENSE.txt"];
		for (const file of filesToCopy) {
			const src = join(root, file);
			if (existsSync(src)) {
				copyFileSync(src, join(distDir, file));
				console.log(`Copied ${file}`);
			}
		}

		// 3. Verify package.json in dist
		console.log("\n\x1b[33m[3/4] Verifying dist/package.json...\x1b[0m");
		const distPkgPath = join(distDir, "package.json");
		if (existsSync(distPkgPath)) {
			const pkg = JSON.parse(readFileSync(distPkgPath, "utf8"));
			console.log(`Ready to publish: ${pkg.name}@${pkg.version}`);
		} else {
			throw new Error("package.json not found in dist directory!");
		}

		// 4. Publish to NPM
		console.log("\n\x1b[33m[4/4] Publishing to NPM...\x1b[0m");
		// We run npm publish directly inside the dist directory
		await run("npm", ["publish", "--access", "public"], distDir);

		console.log(`\n\x1b[32m${"=".repeat(60)}`);
		console.log("   SUCCESS: MetaBun has been published to NPM!");
		console.log("   Check it at: https://www.npmjs.com/package/@meta-bun/core");
		console.log(`${"=".repeat(60)}\x1b[0m`);
	} catch (error: any) {
		console.error(`\n\x1b[31mPublication Failed: ${error.message}\x1b[0m`);
		process.exit(1);
	}
}

main().catch(console.error);
