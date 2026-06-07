# Contributing to MetaBun

First off, thank you for considering contributing to MetaBun! It's people like you that make MetaBun such a great tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, make sure to check our [Issues](https://github.com/C17H19NO3-SS/meta-bun/issues) to see if someone else has already created a ticket. If not, go ahead and [make one](https://github.com/C17H19NO3-SS/meta-bun/issues/new/choose)!

## Setting up your environment

MetaBun is a hybrid framework utilizing C++ (for the Metamod bridge) and TypeScript/Bun (for the framework logic).

### Prerequisites
- [Bun](https://bun.sh/) (latest version)
- CMake (3.10 or higher)
- C++17 compatible compiler (GCC/Clang for Linux)
- Metamod:Source SDKs (managed via git submodules in `sdks/`)

### Setup Steps
1. Fork and clone the repository.
2. Initialize submodules: `git submodule update --init --recursive`
3. Install TypeScript dependencies: `bun install`
4. Build the project (C++ and TS): `bun run build`

## Code Style & Linting

We enforce strict coding standards to keep our codebase clean:
- **TypeScript:** We use [Biome](https://biomejs.dev/) / Prettier+ESLint (see `package.json` scripts). Run `bun run lint` before committing.
- **C++:** We use `clang-format` based on the LLVM style. Make sure to format your `.cpp` and `.h` files.

## Pull Requests

1. **Create a branch:** Create a new branch for your feature or bugfix (e.g., `feature/awesome-new-thing` or `fix/crash-on-load`).
2. **Commit messages:** Write clear, concise commit messages.
3. **Tests:** Ensure all existing tests pass by running `bun test`. If you add a new feature, please add accompanying tests in the `test/` directory.
4. **Submit:** Open a Pull Request targeting the `main` branch. Ensure you fill out the provided PR template.

## Need help?
Feel free to ask questions in the issues or discussions. We are here to help!
