# Supported Games (Metamod:Source) - AlliedModders Wiki
[Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source") generally tries to support most Source engine based games and mods. However, some API features may only be supported by some of them.

### **[User Message API Functions](about:/Introduction_to_SourceMM_Coding#User_Message_Enumeration "Introduction to SourceMM Coding")** - GetUserMessageCount(), FindUserMessage(), GetUserMessage()

These APIs are not supported on games that use Protobuf-encoded user messages due to changes in how they are registered. Those games include:

*   Blade Symphony
*   Counter-Strike: Global Offensive
*   Counter-Strike 2
*   Deadlock
*   Dota 2
*   Military Conflict: Vietnam

### ConCommandBase functions - RegisterConCommandBase(), UnregisterConCommandBase

These functions are deprecated, as there is no concept of ConCommandBase in Source 2. As such, they don't function at all on the below games. Use the ConVar or ConCommand registration / unregistration functions instead.

*   Counter-Strike 2
*   Deadlock
*   Dota 2