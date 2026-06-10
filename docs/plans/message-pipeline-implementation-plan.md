# Message Middleware Pipeline Implementation Plan

This plan details the implementation of a message interception and modification pipeline.

## Task 1: Core Types and Pipeline Manager
- **Context:** We need a central class to manage and execute message middlewares.
- **Requirements:**
  1. Create `src/ts/shared/types/message.ts` defining `MessageContext` and `MessageType` ('chat', 'console', 'hint', 'log').
  2. Create `src/ts/plugin-system/pipeline.ts` with a `MessagePipeline` class.
  3. Implement `register(handler, priority, pluginName)` and `execute(context)` methods.
  4. Middlewares should be sorted by priority (lowest first).
  5. If `context.blocked` is set to true, execution must stop.
- **Review Criteria:** Unit tests verifying registration, priority sorting, and execution flow.

## Task 2: Plugin System Integration
- **Context:** Plugins need to be able to register middlewares, and they must be cleaned up automatically.
- **Requirements:**
  1. Update `IGameBridge` interface in `src/ts/shared/types/bridge.ts` to include `RegisterMessageMiddleware`.
  2. Implement `RegisterMessageMiddleware` in `PluginContext`.
  3. Update `PluginContext.Cleanup()` to remove all middlewares registered by that plugin.
  4. Instantiate `MessagePipeline` in `PluginManager` and pass it to `PluginContext`.
- **Review Criteria:** `PluginContext` successfully delegates registration to the central pipeline and tracks them for cleanup.

## Task 3: Refactoring Message Functions
- **Context:** Existing print and log functions must now pass through the pipeline.
- **Requirements:**
  1. Update `PluginContext.PrintToChat`, `PrintToServerConsole`, `PrintHintText`, and `LogMessage` to use `pipeline.execute()`.
  2. Ensure `FormatColorTags` and `ToAnsi` are called ONLY on the final output *after* the pipeline.
  3. Update `PluginManager`'s internal logging to also respect the pipeline if appropriate.
- **Review Criteria:** Calling `PrintToChat` results in a pipeline execution before sending to the bridge.

## Task 4: Global Prefix Override Verification
- **Context:** Verifying that a high-priority middleware can override other plugins' prefixes.
- **Requirements:**
  1. Add an integration test in `test/integration/message-pipeline.test.ts`.
  2. Register a middleware that changes `ctx.prefix` to `[OVERRIDDEN]`.
  3. Verify that a subsequent `PrintToChat` call from any plugin uses the new prefix.
  4. Verify that blocking a message works correctly.
- **Review Criteria:** All integration tests pass, demonstrating prefix override and blocking capabilities.
