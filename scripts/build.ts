import { spawn } from "child_process";
import fs from "fs";
import path from "path";

async function runCommand(command: string, args: string[], cwd: string = "."): Promise<void> {
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
    console.log(`[Build Script] Cleaning existing addons directory at: ${distAddonsDir}`);
    fs.rmSync(distAddonsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distAddonsDir, { recursive: true });

  // 2. Compile C++ Plugin inside Debian 12 Docker container for GLIBC 2.36 compatibility
  try {
    await runCommand("docker", [
      "run", "--rm",
      "-v", `${rootDir}:/workspace`,
      "-w", "/workspace",
      "debian:12",
      "bash", "-c",
      "apt-get update && apt-get install -y build-essential cmake libprotobuf-dev protobuf-compiler && rm -rf src/cpp/build && ./src/cpp/build.sh --sdk /workspace/sdks/hl2sdk-cs2 --mmsrc /workspace/sdks/metamod-source --release && cp -v /usr/lib/x86_64-linux-gnu/libprotobuf.so.32 /workspace/src/cpp/build/package/addons/meta-bun/bin/"
    ], rootDir);
  } catch (err) {
    console.error("[Build Script] C++ Plugin compilation failed!");
    process.exit(1);
  }

  // 3. Bundle the TS Application (the server runtime — index.js)
  console.log("[Build Script] Bundling TS application using Bun...");
  const bundleResult = await Bun.build({
    entrypoints: [path.join(rootDir, "src/ts/index.ts")],
    outdir: path.join(distAddonsDir, "meta-bun"),
    target: "bun",
    minify: false,
  });

  if (!bundleResult.success) {
    console.error("[Build Script] Bun bundling failed!");
    for (const message of bundleResult.logs) {
      console.error(message);
    }
    process.exit(1);
  }
  console.log("[Build Script] Bun bundling completed successfully.");

  // 4. Copy the compiled C++ plugin binary to dist/addons/meta-bun/bin/
  const cppPackageBinDir = path.join(rootDir, "src/cpp/build/package/addons/meta-bun/bin");
  const targetBinDir = path.join(distAddonsDir, "meta-bun/bin");
  fs.mkdirSync(targetBinDir, { recursive: true });

  const filesInBin = fs.readdirSync(cppPackageBinDir);
  for (const file of filesInBin) {
    if (file.includes(".so") || file.endsWith(".dll")) {
      const srcFile = path.join(cppPackageBinDir, file);
      const destFile = path.join(targetBinDir, file);
      console.log(`[Build Script] Copying plugin binary: ${file}`);
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // Copy host's bun binary as a bundled runtime to targetBinDir
  const hostBunPath = "/root/.bun/bin/bun";
  if (fs.existsSync(hostBunPath)) {
    const destBunPath = path.join(targetBinDir, "bun");
    console.log(`[Build Script] Copying host Bun runtime to: ${destBunPath}`);
    fs.copyFileSync(hostBunPath, destBunPath);
    fs.chmodSync(destBunPath, 0o755);
  } else {
    console.warn(`[Build Script] Warning: Host Bun runtime not found at ${hostBunPath}`);
  }

  // 5. Copy the Plugin SDK so plugins can resolve "meta-bun/core" at runtime.
  //
  //    Layout in dist/addons/meta-bun/:
  //      sdk/      ← copy of src/ts/natives/   (core.ts, player.ts, …)
  //      shared/   ← copy of src/ts/shared/    (types/, plugin.ts, …)
  //
  //    context-store.ts is replaced by a lightweight globalThis-based shim.
  //    The bundled runtime (index.js) creates the AsyncLocalStorage instance and
  //    stores it on globalThis.__metaBunContextStore.  The shim reads from there,
  //    so even though sdk/core.ts is a separate module instance it shares the
  //    exact same async context as the runtime.
  const metaBunDistDir = path.join(distAddonsDir, "meta-bun");
  const sdkDestDir     = path.join(metaBunDistDir, "sdk");
  const sharedDestDir  = path.join(metaBunDistDir, "shared");

  console.log("[Build Script] Copying Plugin SDK (natives + shared) to dist...");
  fs.cpSync(path.join(rootDir, "src/ts/natives"), sdkDestDir,    { recursive: true });
  fs.cpSync(path.join(rootDir, "src/ts/shared"),  sharedDestDir, { recursive: true });

  // Overwrite context-store.ts with the globalThis shim (no plugin-system imports).
  const ctxStoreShim = `import { AsyncLocalStorage } from "node:async_hooks";

/**
 * SDK context-store shim used inside the deployed dist/.
 *
 * The MetaBun runtime (index.js) stores its AsyncLocalStorage instance on
 * globalThis.__metaBunContextStore so that sdk/ copies of the natives — which
 * Bun loads as separate module instances — still share the exact same context
 * as the bundled runtime.
 */
export function GetContext(): any {
  const store: AsyncLocalStorage<any> | undefined =
    (globalThis as any).__metaBunContextStore;
  if (!store) {
    throw new Error(
      "[MetaBun] Context store not found. Make sure the MetaBun runtime is loaded."
    );
  }
  const context = store.getStore();
  if (!context) {
    throw new Error("[MetaBun] Native function called outside of an active plugin context!");
  }
  return context;
}

/** Compatibility alias so import-only consumers do not break. */
export const pluginContextStore = {
  getStore: (): any => (globalThis as any).__metaBunContextStore?.getStore(),
} as any;
`;
  fs.writeFileSync(path.join(sharedDestDir, "context-store.ts"), ctxStoreShim, "utf8");
  console.log("[Build Script] Wrote SDK context-store shim.");

  // 6. Generate metabun.vdf for Metamod
  const metamodDir = path.join(distAddonsDir, "metamod");
  fs.mkdirSync(metamodDir, { recursive: true });
  const vdfContent = `"Metamod Plugin"
{
\t"alias"\t"metabun"
\t"file"\t"addons/meta-bun/bin/libmetabun_plugin"
}
`;
  fs.writeFileSync(path.join(metamodDir, "metabun.vdf"), vdfContent);
  console.log(`[Build Script] Generated Metamod VDF loader at: ${path.join(metamodDir, "metabun.vdf")}`);

  // 7. Copy configs, plugins, translations
  for (const dir of ["configs", "plugins", "translations"]) {
    const srcPath  = path.join(rootDir, dir);
    const destPath = path.join(metaBunDistDir, dir);
    if (fs.existsSync(srcPath)) {
      console.log(`[Build Script] Copying directory: ${dir}`);
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  }

  // 8. Write package.json — strip dev fields, add exports map for "meta-bun/*" resolution
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.module  = "index.js";
    pkg.main    = "index.js";
    pkg.exports = {
      ".":         "./index.js",
      "./core":    "./sdk/core.ts",
      "./player":  "./sdk/player.ts",
      "./console": "./sdk/console.ts",
      "./events":  "./sdk/events.ts",
      "./timers":  "./sdk/timers.ts",
      "./menus":   "./sdk/menus.ts",
      "./shared/*": "./shared/*.ts",
    };
    delete pkg.scripts;
    delete pkg.devDependencies;
    delete pkg.peerDependencies;
    fs.writeFileSync(
      path.join(metaBunDistDir, "package.json"),
      JSON.stringify(pkg, null, 2),
      "utf8"
    );
    console.log("[Build Script] Wrote package.json with exports map.");
  }

  // 9. Write tsconfig.json for dist — fixed paths pointing to sdk/
  //    (We write it fresh because the source tsconfig.json contains // comments
  //     that make it invalid JSON for JSON.parse.)
  const distTsConfig = {
    compilerOptions: {
      paths: {
        "meta-bun":   ["./sdk/index.ts"],
        "meta-bun/shared/*": ["./shared/*"],
        "meta-bun/*": ["./sdk/*.ts"],
      },
      lib: ["ESNext"],
      target: "ESNext",
      module: "Preserve",
      moduleDetection: "force",
      jsx: "react-jsx",
      allowJs: true,
      types: ["bun"],
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      verbatimModuleSyntax: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
    },
  };
  fs.writeFileSync(
    path.join(metaBunDistDir, "tsconfig.json"),
    JSON.stringify(distTsConfig, null, 2),
    "utf8"
  );
  console.log("[Build Script] Wrote dist tsconfig.json with sdk/ paths.");


  // 10. Copy bunfig.toml as-is
  const bunfigPath = path.join(rootDir, "bunfig.toml");
  if (fs.existsSync(bunfigPath)) {
    fs.copyFileSync(bunfigPath, path.join(metaBunDistDir, "bunfig.toml"));
    console.log("[Build Script] Copied bunfig.toml.");
  }

  console.log("\n========================================================");
  console.log("[Build Script] ✅ BUILD COMPLETED SUCCESSFULLY!");
  console.log(`[Build Script] Ready to upload to server: ${distAddonsDir}`);
  console.log("========================================================");
}

main().catch((err) => {
  console.error("[Build Script] Unexpected error:", err);
  process.exit(1);
});
