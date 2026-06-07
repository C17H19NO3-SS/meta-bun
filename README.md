# MetaBun — Bun-Powered Metamod Plugin Framework

> A high-performance, TypeScript-first plugin system for Source-engine game servers.  
> Connects a C++ Metamod plugin to a Bun runtime via a low-latency bridge.

---

## 🚀 Quick Start (For Developers)

Create a new plugin in seconds using our global CLI:

```bash
# Install the core toolkit globally
bun i -g @meta-bun/core

# Create a new plugin project
create-metabun-plugin my-cool-plugin
# ... OR initialize in current directory
create-metabun-plugin .

# Build your plugin
cd my-cool-plugin
bun run build
```

---

## 🛠️ Features

- **Blazing Fast:** Powered by the Bun runtime for near-native performance.
- **Strictly Typed:** Full IntelliSense and type safety for all game events.
- **Hot Reloading:** Plugins reload automatically when you save changes.
- **Modern Workflow:** Write in TypeScript, use NPM packages, and enjoy a modern dev ecosystem.
- **Unified Update System:** Keep the core, SDKs, and GeoIP data up-to-date with a single command.

---

## 📦 Framework Management

### Update System (Development)
Keep your development environment and framework core up-to-date:
```bash
bun run update
```
*Updates: Core Repo, Metamod SDKs, Bun Runtime, Dependencies, GeoIP, and Rebuilds everything.*

### Production Installation (On Server)
Update or install MetaBun on your production CS2 server (inside Docker/Container):
```bash
export CS2_PATH="/path/to/game/csgo"
bun run install-server
```
*Safely updates files while preserving your `configs/` and `plugins/` folders.*

### Manual NPM Publication
If you want to bypass CI/CD and publish the core package manually:
```bash
bun run npm-publish
```

---

## 💻 Plugin Development Example

MetaBun provides full IntelliSense. When you type `game.HookEvent("PlayerDeath", ...)`, your editor knows exactly what's inside the `data` object!

```typescript
import { BasePlugin, type IGameBridge } from "@meta-bun/core";

export default class MyPlugin extends BasePlugin {
  public override name = "My Cool Plugin";
  
  public override async OnLoad(game: IGameBridge) {
    // IntelliSense powered event hooks
    game.HookEvent("PlayerDeath", (data) => {
      game.PrintToChatAll(`{Red}${data.victim_name}{Default} was killed by {Blue}${data.attacker_name}`);
    });

    // Easy command registration
    game.RegConsoleCmd("sm_test", (client) => {
      game.PrintToChat(client, "MetaBun is working!");
    });
  }
}
```

---

## 📂 Project Structure

- `src/cpp/`: C++ Metamod bridge source.
- `src/ts/`: TypeScript framework core and natives.
- `plugins/`: Directory for your active plugins.
- `configs/`: Central configuration (Admins, GeoIP, Settings).
- `sdks/`: Source engine and Metamod SDKs.
- `scripts/`: Automation tools for building and deploying.

---

## ⚖️ License & Responsibility

This project is licensed under the **MIT License**. You are free to:
- Use, copy, and modify the software for any purpose.
- Distribute and sell the software.
- Include it in private or commercial projects.

**Disclaimer:**  
The software is provided "as is", without warranty of any kind. The authors or copyright holders are not responsible for any damage, server bans, or data loss resulting from the use of this framework. By using MetaBun, you assume all responsibility for its implementation and consequences on your game server.

---

**Maintained with ❤️ by [C17H19NO3-SS](https://github.com/C17H19NO3-SS)**
