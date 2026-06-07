#!/usr/bin/env bun
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

const projectName = process.argv[2] || "my-metabun-plugin";
const projectPath = join(process.cwd(), projectName);

console.log(`\n\x1b[35m🚀 Creating MetaBun Plugin: ${projectName}...\x1b[0m`);

if (existsSync(projectPath)) {
  console.error(`\x1b[31mError: Directory ${projectName} already exists.\x1b[0m`);
  process.exit(1);
}

// 1. Create directory structure
mkdirSync(projectPath, { recursive: true });
mkdirSync(join(projectPath, "src"), { recursive: true });

// 2. Create package.json
const pkg = {
  name: projectName,
  version: "1.0.0",
  type: "module",
  scripts: {
    "build": "bun build ./src/index.ts --outdir ./dist --target bun",
    "dev": "bun build ./src/index.ts --outdir ./dist --target bun --watch"
  },
  dependencies: {
    "@meta-bun/core": "latest"
  }
};
writeFileSync(join(projectPath, "package.json"), JSON.stringify(pkg, null, 2));

// 3. Create tsconfig.json
const tsconfig = {
  compilerOptions: {
    lib: ["ESNext"],
    module: "ESNext",
    target: "ESNext",
    moduleResolution: "bundler",
    moduleDetection: "force",
    allowImportingTsExtensions: true,
    strict: true,
    skipLibCheck: true,
    types: ["bun"]
  }
};
writeFileSync(join(projectPath, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

// 4. Create example plugin code
const exampleCode = `import { BasePlugin, type IGameBridge } from "@meta-bun/core";

export default class ${projectName.split("-").map(s => s.charAt(0).toUpperCase() + s.slice(1)).join("")} extends BasePlugin {
  public override name = "${projectName}";
  public override version = "1.0.0";
  public override author = "Developer";

  public override async OnLoad(game: IGameBridge) {
    game.LogMessage("${projectName} plugin loaded!");

    // Example: Hook an event with full IntelliSense
    game.HookEvent("PlayerChat", (data) => {
      game.PrintToChatAll(\`{Green}\${data.name}{Default}: \${data.text}\`);
    });

    // Example: Register a command
    game.RegConsoleCmd("sm_hello", (client) => {
      game.PrintToChat(client, "{Yellow}Hello from ${projectName}!");
    }, "A simple hello command");
  }
}
`;
writeFileSync(join(projectPath, "src", "index.ts"), exampleCode);

// 5. Create .gitignore
writeFileSync(join(projectPath, ".gitignore"), "node_modules/\ndist/\n.bun/\n");

// 6. Install dependencies
console.log("\x1b[33m📦 Installing dependencies (this may take a moment)...\x1b[0m");
spawnSync("bun", ["install"], { cwd: projectPath, stdio: "inherit" });

console.log("\n\x1b[32m✅ Successfully created MetaBun Plugin Project!\x1b[0m");
console.log(`\nNext steps:
  1. cd ${projectName}
  2. Write your code in src/index.ts
  3. Run 'bun run build' to package your plugin
\x1b[0m`);
console.log(`\nNext steps:
  1. cd ${projectName}
  2. Write your code in src/index.ts
  3. Run 'bun run build' to package your plugin
\x1b[0m`);
