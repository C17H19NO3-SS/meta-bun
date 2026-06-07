# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-06-07

### Added
- **Community Standards:** Added `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.
- **GitHub Templates:** Added Issue (`bug_report.yml`, `feature_request.yml`) and PR templates.
- **CI/CD:** Configured `.github/workflows/ci.yml` for automated linting, building, and testing.
- **Dependabot:** Added configuration to keep NPM and GitHub Actions dependencies up to date.
- **Code Quality:** Integrated `Biome` for blazing fast TypeScript linting/formatting and `clang-format` (LLVM style) for C++ code.
- **Pre-commit Hooks:** Added `husky` and `lint-staged` to enforce Biome checks before commits.
- **MsgPack Protocol Foundation:** Added foundational logic in `Bridge.ts` for switching from NDJSON to Binary MsgPack (`length_prefixed_msgpack`) to dramatically reduce CPU overhead in high-tickrate servers. *(Note: C++ MsgPack parser integration is currently in progress).*
- **Plugin Isolation (Worker Threads):** Added architecture plans and experimental flags for spawning Metamod plugins in isolated `Bun.Worker` instances to prevent a single poorly written plugin from freezing the main server loop.

### Changed
- **TypeScript Strictness:** Set `noUnusedLocals`, `noUnusedParameters`, and `noPropertyAccessFromIndexSignature` to `true` in `tsconfig.json` to prevent messy code contributions.
- **Automated Refactoring:** Applied `biome check --write` across the TS codebase to eliminate all unused variable warnings and enforce formatting.
- **Documentation:** Updated `README.md` to clearly state that the development/test environment perfectly mirrors the production Ubuntu Linux servers for consistency.

### Fixed
- **C++ Silent Failures:** Fixed critical issue where `catch (...) {}` blocks in `core/metabun_plugin.cpp` swallowed exceptions silently. Replaced empty catches with `std::cerr` logging to ensure server admins are notified of bridge errors or parsing failures.
