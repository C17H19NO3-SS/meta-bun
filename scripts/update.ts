import { spawn } from "child_process";
import { join, resolve } from "path";
import { existsSync } from "fs";

/**
 * Utility to run shell commands and stream output
 */
async function run(command: string, args: string[], cwd: string = "."): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`\n\x1b[36m[Update] Executing: ${command} ${args.join(" ")}\x1b[0m`);
        const proc = spawn(command, args, { stdio: "inherit", cwd });
        proc.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Command "${command} ${args.join(" ")}" failed with code ${code}`));
        });
    });
}

async function main() {
    const root = resolve(import.meta.dir, "..");

    console.log("\x1b[35m" + "=".repeat(60));
    console.log("             METABUN FRAMEWORK UPDATE SYSTEM");
    console.log("=".repeat(60) + "\x1b[0m");

    try {
        // 1. Update Core Repository
        console.log("\n\x1b[33m[1/6] Updating MetaBun Core Repository...\x1b[0m");
        try {
            await run("git", ["pull"], root);
        } catch (e) {
            console.warn("\x1b[31mFailed to pull core repository. It might not be a git repo or has local changes.\x1b[0m");
        }

        // 2. Update SDKs (Metamod side)
        console.log("\n\x1b[33m[2/6] Updating Metamod & HL2SDKs...\x1b[0m");
        const sdks = [
            { name: "HL2SDK-CS2", path: "sdks/hl2sdk-cs2" },
            { name: "Metamod-Source", path: "sdks/metamod-source" }
        ];

        for (const sdk of sdks) {
            const sdkPath = join(root, sdk.path);
            if (existsSync(sdkPath)) {
                console.log(`\nUpdating ${sdk.name} in ${sdkPath}...`);
                try {
                    await run("git", ["pull"], sdkPath);
                } catch (e) {
                    console.warn(`\x1b[31mFailed to update ${sdk.name}. Skipping...\x1b[0m`);
                }
            } else {
                console.warn(`\x1b[31m${sdk.name} not found at ${sdkPath}.\x1b[0m`);
            }
        }

        // 3. Update Bun Runtime
        console.log("\n\x1b[33m[3/6] Checking for Bun Runtime updates...\x1b[0m");
        try {
            await run("bun", ["upgrade"], root);
        } catch (e) {
            console.warn("\x1b[31mFailed to upgrade Bun. Continuing...\x1b[0m");
        }

        // 4. Update Bun Dependencies (Bun side)
        console.log("\n\x1b[33m[4/7] Updating Project Dependencies...\x1b[0m");
        await run("bun", ["install"], root);

        // 5. Update GeoIP Database
        console.log("\n\x1b[33m[5/7] Updating GeoIP Database...\x1b[0m");
        try {
            await run("bun", ["run", "scripts/update_geoip_global.ts"], root);
        } catch (e) {
            console.warn("\x1b[31mFailed to update GeoIP database. Continuing...\x1b[0m");
        }

        // 6. Update Docker Image (for C++ builds)
        console.log("\n\x1b[33m[6/7] Updating Build Environment (Docker)...\x1b[0m");
        try {
            await run("docker", ["pull", "debian:12"], root);
        } catch (e) {
            console.warn("\x1b[31mFailed to pull Docker image. Continuing...\x1b[0m");
        }

        // 7. Full Rebuild
        console.log("\n\x1b[33m[7/7] Performing Full Rebuild...\x1b[0m");
        await run("bun", ["run", "build"], root);

        console.log("\n\x1b[32m" + "=".repeat(60));
        console.log("   SUCCESS: MetaBun Framework, SDKs, and GeoIP are up to date!");
        console.log("=".repeat(60) + "\x1b[0m");

    } catch (error: any) {
        console.error(`\n\x1b[31mUpdate Failed: ${error.message}\x1b[0m`);
        process.exit(1);
    }
}

main().catch(console.error);
