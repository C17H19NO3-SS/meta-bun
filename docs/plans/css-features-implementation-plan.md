# CSS Features Implementation Plan

This plan details the implementation steps for the MetaBun CSS Features Integration Design.

## Task 1: SchemaGen Core (Dump Phase & CLI Skeleton)
- **Context:** We need a way to dump the CS2 Schema from the C++ Metamod bridge into a JSON file, and a Bun CLI tool to read it.
- **Requirements:**
  1. Add a new action type in `src/ts/shared/types/bridge.ts` for schema dumping (e.g., `dump_schema`).
  2. Implement a mock response in `src/ts/mock/bridge.ts` that simulates a C++ schema dump (returning a JSON string with dummy class `CCSPlayerController` and property `m_iHealth`).
  3. Create a CLI script `scripts/generate_schema.ts`.
  4. The script should request the schema dump from the bridge, parse the JSON, and ensure `src/ts/generated/` exists.
- **Review Criteria:** Running `bun run scripts/generate_schema.ts` should successfully communicate with the mock bridge and create an empty `src/ts/generated/index.ts` file.

## Task 2: SchemaGen Code Emission
- **Context:** The CLI tool needs to convert the JSON schema into TypeScript proxy classes.
- **Requirements:**
  1. Update `scripts/generate_schema.ts` to parse the JSON schema.
  2. For each class in the schema, generate a TypeScript class that takes an `entityId` in its constructor.
  3. For each property in the class, generate a getter and a setter.
  4. The setter MUST call `globalThis.Bridge.Send({ action: "SetEntityProp", entityId, propName, value })`.
  5. Generate tests for the emitted code.
- **Review Criteria:** The generated code should be syntactically correct TypeScript and correctly route assignments to the bridge.

## Task 3: Rule-Based Hook System (AST Definitions)
- **Context:** We need TypeScript definitions for the Abstract Syntax Tree (AST) that will represent synchronous hook conditions.
- **Requirements:**
  1. Create `src/ts/shared/types/ast.ts`.
  2. Define interfaces for `RuleNode` (e.g., `Type: "AND" | "OR" | "EQ" | "GT"`).
  3. Create a helper class `Filter` in `src/ts/shared/filter.ts` with static methods like `Eq(field, value)`, `And(rule1, rule2)` to easily construct these trees.
  4. Add unit tests for the `Filter` class.
- **Review Criteria:** Developers should be able to construct complex rules cleanly using the `Filter` class, resulting in a correct JSON serializable tree.

## Task 4: High-Level UI Components (CenterHtmlMenu)
- **Context:** Abstracting raw UserMessages into clean OOP UI components.
- **Requirements:**
  1. Create `src/ts/ui/CenterHtmlMenu.ts`.
  2. The class should accept an HTML string in its constructor.
  3. Implement a `Show(player: Player)` method.
  4. The `Show` method must format a structured payload `action: "send_user_message", msg_type: "CenterHtml", html: "..."` and send it via the bridge.
  5. Add unit tests verifying the correct bridge payload is sent when `Show()` is called.
- **Review Criteria:** Clean OOP API that successfully translates into the expected bridge JSON payload.
