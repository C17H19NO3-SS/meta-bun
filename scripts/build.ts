import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

async function runCommandWithOutput(
	command: string,
	args: string[],
	cwd: string = ".",
): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(command, args, { stdio: "pipe", cwd });
		let output = "";
		proc.stdout.on("data", (data) => {
			output += data.toString();
		});
		proc.on("close", (code) => {
			if (code === 0) resolve(output);
			else reject(new Error(`Command failed with code ${code}`));
		});
	});
}

async function runCommand(
	command: string,
	args: string[],
	cwd: string = ".",
): Promise<void> {
	return new Promise((resolve, reject) => {
		console.log(`[Build Script] Running command: ${command} ${args.join(" ")}`);
		const proc = spawn(command, args, { stdio: "inherit", cwd });
		proc.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Command failed with code ${code}`));
		});
	});
}

async function main() {
	const rootDir = path.resolve(import.meta.dir, "..");
	const distDir = path.join(rootDir, "dist");
	const distAddonsDir = path.join(distDir, "addons");

	console.log("[Build Script] Starting build process...");

	// 1. Clean dist/addons directory
	if (fs.existsSync(distAddonsDir)) {
		console.log(
			`[Build Script] Cleaning existing addons directory at: ${distAddonsDir}`,
		);
		fs.rmSync(distAddonsDir, { recursive: true, force: true });
	}
	fs.mkdirSync(distAddonsDir, { recursive: true });

	// 2. Compile C++ Plugin inside a persistent Docker builder container
	try {
		const builderImage = "metabun-builder:v2";
		let imageExists = false;
		try {
			const images = await runCommandWithOutput(
				"docker",
				["images", "-q", builderImage],
				rootDir,
			);
			if (images.trim().length > 0) {
				imageExists = true;
			}
		} catch (_e) {
			imageExists = false;
		}

		if (!imageExists) {
			console.log(
				`[Build Script] Builder image "${builderImage}" not found. Creating it...`,
			);
			const dockerfileContent = `
FROM debian:12
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    && rm -rf /var/lib/apt/lists/*
`;
			fs.writeFileSync(
				path.join(rootDir, "Dockerfile.builder"),
				dockerfileContent,
			);
			await runCommand(
				"docker",
				["build", "-t", builderImage, "-f", "Dockerfile.builder", "."],
				rootDir,
			);
			fs.unlinkSync(path.join(rootDir, "Dockerfile.builder"));
		}

		console.log(
			`[Build Script] Using persistent builder image: ${builderImage}`,
		);

		// 2a. Generate Protobuf headers from SDK
		console.log("[Build Script] Generating Protobuf headers...");
		await runCommand(
			"docker",
			[
				"run",
				"--rm",
				"-v",
				`${rootDir}:/workspace`,
				"-w",
				"/workspace",
				builderImage,
				"bash",
				"-c",
				"mkdir -p src/cpp/generated && for f in sdks/hl2sdk-cs2/common/*.proto; do sdks/hl2sdk-cs2/devtools/bin/linux/protoc --proto_path=sdks/hl2sdk-cs2/common --proto_path=sdks/hl2sdk-cs2/thirdparty/protobuf-3.21.8/src --cpp_out=src/cpp/generated $f; done",
			],
			rootDir,
		);

		// 2b. Generate compatibility symlinks
		console.log("[Build Script] Creating compatibility symlinks...");
		await runCommand(
			"docker",
			[
				"run",
				"--rm",
				"-v",
				`${rootDir}:/workspace`,
				"-w",
				"/workspace",
				builderImage,
				"bash",
				"-c",
				"mkdir -p src/cpp/generated/tier1 && ln -sf /workspace/sdks/hl2sdk-cs2/public/tier0/interface.h src/cpp/generated/tier1/interface.h && ln -sf /workspace/sdks/hl2sdk-cs2/public/toolframework/itoolentity.h src/cpp/generated/iservertools.h && ln -sf /workspace/sdks/hl2sdk-cs2/public/eiface.h src/cpp/generated/iservergameents.h",
			],
			rootDir,
		);

		await runCommand(
			"docker",
			[
				"run",
				"--rm",
				"-v",
				`${rootDir}:/workspace`,
				"-w",
				"/workspace",
				builderImage,
				"bash",
				"-c",
				"rm -rf src/cpp/build && ./src/cpp/build.sh --sdk /workspace/sdks/hl2sdk-cs2 --mmsrc /workspace/sdks/metamod-source --release",
			],
			rootDir,
		);
	} catch (_err) {
		console.error("[Build Script] C++ Plugin compilation failed!");
		process.exit(1);
	}

	const metaBunDistDir = path.join(distAddonsDir, "meta-bun");

	// 3. Bundle the Core Framework SDK as a single file for plugins to import
	// This ensures AsyncLocalStorage (context) is shared via the same module instance
	console.log("[Build Script] Bundling MetaBun Core SDK...");
	const sdkResult = await Bun.build({
		entrypoints: [path.join(rootDir, "src/ts/natives.ts")],
		outdir: path.join(metaBunDistDir, "sdk"),
		naming: "core.js",
		target: "bun",
		minify: true,
	});

	if (!sdkResult.success) {
		console.error("[Build Script] SDK bundling failed!");
		process.exit(1);
	}

	// 4. Bundle the TS Application (the server runtime — index.js)
	console.log("[Build Script] Bundling TS application using Bun...");
	const bundleResult = await Bun.build({
		entrypoints: [path.join(rootDir, "src/ts/index.ts")],
		outdir: metaBunDistDir,
		target: "bun",
		minify: true,
		external: ["meta-bun", "@meta-bun/core"], // Treat SDK as external in main app too if needed
	});

	if (!bundleResult.success) {
		console.error("[Build Script] Bun bundling failed!");
		for (const message of bundleResult.logs) console.error(message);
		process.exit(1);
	}

	// 5. Copy the compiled C++ plugin binary
	const cppPackageBinDir = path.join(
		rootDir,
		"src/cpp/build/package/addons/meta-bun/bin",
	);
	const targetBinDir = path.join(metaBunDistDir, "bin");
	fs.mkdirSync(targetBinDir, { recursive: true });

	if (fs.existsSync(cppPackageBinDir)) {
		const filesInBin = fs.readdirSync(cppPackageBinDir);
		for (const file of filesInBin) {
			if (file.includes(".so") || file.endsWith(".dll")) {
				fs.copyFileSync(
					path.join(cppPackageBinDir, file),
					path.join(targetBinDir, file),
				);
			}
		}
	}

	// Copy host's bun binary
	const hostBunPath = "/root/.bun/bin/bun";
	if (fs.existsSync(hostBunPath)) {
		const destBunPath = path.join(targetBinDir, "bun");
		fs.copyFileSync(hostBunPath, destBunPath);
		fs.chmodSync(destBunPath, 0o755);
	}

	// 6. Generate metabun.vdf for Metamod
	const metamodDir = path.join(distAddonsDir, "metamod");
	fs.mkdirSync(metamodDir, { recursive: true });
	const vdfContent = `"Metamod Plugin"\n{\n\t"alias"\t"metabun"\n\t"file"\t"addons/meta-bun/bin/metabun_bridge_mm"\n}\n`;
	fs.writeFileSync(path.join(metamodDir, "metabun.vdf"), vdfContent);

	// 7. Copy configs, translations
	for (const dir of ["configs", "translations"]) {
		const srcPath = path.join(rootDir, dir);
		const destPath = path.join(metaBunDistDir, dir);
		if (fs.existsSync(srcPath))
			fs.cpSync(srcPath, destPath, { recursive: true });
	}

	// 8. Compile Plugins - IMPORTANT: Mark framework as external
	// They will resolve it from the /sdk/core.js we created.
	const pluginsSrcDir = path.join(rootDir, "plugins");
	const pluginsDestDir = path.join(metaBunDistDir, "plugins");
	fs.mkdirSync(pluginsDestDir, { recursive: true });

	if (fs.existsSync(pluginsSrcDir)) {
		const plugins = fs.readdirSync(pluginsSrcDir);
		for (const pluginName of plugins) {
			const pluginPath = path.join(pluginsSrcDir, pluginName);
			if (fs.statSync(pluginPath).isDirectory()) {
				console.log(`[Build Script] Compiling plugin: ${pluginName}`);
				const entryPoint = path.join(pluginPath, "index.ts");
				if (fs.existsSync(entryPoint)) {
					const pluginOutDir = path.join(pluginsDestDir, pluginName);
					fs.mkdirSync(pluginOutDir, { recursive: true });

					await Bun.build({
						entrypoints: [entryPoint],
						outdir: pluginOutDir,
						target: "bun",
						minify: true,
						// Redirect framework imports to our bundled core.js
						external: ["meta-bun", "meta-bun/*", "@meta-bun/core"],
					});

					const pkgJsonPath = path.join(pluginPath, "package.json");
					if (fs.existsSync(pkgJsonPath)) {
						const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
						pkg.main = "index.js";
						pkg.module = "index.js";
						fs.writeFileSync(
							path.join(pluginOutDir, "package.json"),
							JSON.stringify(pkg, null, 2),
							"utf8",
						);
					}
				}
			}
		}
	}

	// 9. Write minimal package.json for root
	const pkgPath = path.join(rootDir, "package.json");
	if (fs.existsSync(pkgPath)) {
		const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
		pkg.name = "meta-bun"; // Simplified name for easier resolution
		pkg.main = "index.js";
		delete pkg.scripts;
		delete pkg.devDependencies;
		delete pkg.peerDependencies;

		// Map meta-bun/core and others to bundled files
		pkg.exports = {
			"./core": "./sdk/core.js",
			"./sdk/*": "./sdk/*.js",
			"./shared/*": "./shared/*.js",
		};

		fs.writeFileSync(
			path.join(metaBunDistDir, "package.json"),
			JSON.stringify(pkg, null, 2),
			"utf8",
		);
		console.log("[Build Script] Wrote minimal package.json with exports.");
	}

	// 10. Final pruning
	const finalPrune = (dir: string) => {
		if (!fs.existsSync(dir)) return;
		const files = fs.readdirSync(dir);
		for (const file of files) {
			const fullPath = path.join(dir, file);
			if (fs.statSync(fullPath).isDirectory()) {
				finalPrune(fullPath);
				if (fs.readdirSync(fullPath).length === 0) fs.rmdirSync(fullPath);
			} else {
				if (
					file.endsWith(".ts") ||
					file.endsWith(".tsx") ||
					file.endsWith(".md")
				) {
					fs.unlinkSync(fullPath);
				}
			}
		}
	};
	finalPrune(metaBunDistDir);

	// 11. Create a node_modules/meta-bun link to allow plugins to resolve the framework
	const nodeModulesDir = path.join(metaBunDistDir, "node_modules");
	if (!fs.existsSync(nodeModulesDir)) {
		fs.mkdirSync(nodeModulesDir, { recursive: true });
	}
	const metaBunLink = path.join(nodeModulesDir, "meta-bun");
	if (!fs.existsSync(metaBunLink)) {
		try {
			// Symlink to the parent directory so Bun finds our package.json and exports
			fs.symlinkSync("..", metaBunLink, "dir");
			console.log("[Build Script] Created node_modules/meta-bun symlink.");
		} catch (e) {
			console.warn(
				"[Build Script] Warning: Could not create symlink, plugins might fail to resolve framework.",
			);
		}
	}

	console.log("\n========================================================");
	console.log("[Build Script] ✅ BUILD COMPLETED SUCCESSFULLY!");
	console.log("========================================================");
}

main().catch((err) => {
	console.error("[Build Script] Unexpected error:", err);
	process.exit(1);
});
