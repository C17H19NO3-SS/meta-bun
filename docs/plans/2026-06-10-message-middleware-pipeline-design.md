# MetaBun Message Middleware Pipeline Design

## Overview
This design document defines a synchronous and asynchronous message processing pipeline (middleware) for MetaBun. It allows plugins to intercept, modify, or block messages before they are sent to the C++ Metamod bridge. This enables advanced features like global prefix overrides, message filtering, and priority-based processing.

## 1. MessageContext Data Structure
Every message passed through the pipeline is encapsulated in a `MessageContext` object.

```typescript
interface MessageContext {
    text: string;         // The actual message content
    prefix: string;       // The tag/prefix (e.g., "[MetaBun]")
    target: number;       // Client index (0 for all, -1 for console)
    type: MessageType;    // 'chat' | 'console' | 'hint' | 'log'
    sourcePlugin: string; // Name of the originating plugin
    blocked: boolean;     // If true, the message will not be sent
}
```

## 2. Middleware Registration
Plugins can register middleware functions via `PluginContext`.

- **Signature:** `(ctx: MessageContext) => void | Promise<void>`
- **Priority:** A numeric value where lower numbers execute earlier in the pipeline.
- **Cleanup:** Middleware functions registered by a plugin are automatically removed when the plugin is unloaded.

## 3. Pipeline Execution Logic
1. **Creation:** When a native function like `PrintToChat` is called, a `MessageContext` is initialized.
2. **Sort:** Middleware functions are sorted by their `priority` values.
3. **Iteration:** The pipeline iterates through each middleware.
   - Middlewares can modify any field in the `MessageContext`.
   - If `blocked` is set to `true`, the pipeline terminates immediately.
4. **Finalization:** After all middlewares complete, the final `prefix` and `text` are combined.
5. **Encoding:** The resulting string is passed through `FormatColorTags`.
6. **Transmission:** The final encoded message is sent to the bridge.

## 4. Architectural Goals
- **Safety:** Middleware errors are caught via try-catch to prevent crashing the message system.
- **Priority Management:** Allows a "Master Override" plugin to register with a high priority (run last) to ensure its changes stick.
- **Flexibility:** Supports both synchronous and asynchronous (async/await) middleware functions.
