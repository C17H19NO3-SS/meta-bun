# Sourcehook - AlliedModders Wiki
This article is a stub. Help by [expanding it](http://wiki.amxmodx.org/index.php?title=Sourcehook&action=edit)

SourceHook is a versatile library for hooking virtual functions. SourceHook was designed for declaring single hooks against a given virtual function and a specific _this_ pointer.

For more information about SourceHook's features and API, see [SourceHook Development](https://wiki.alliedmods.net/SourceHook_Development "SourceHook Development").

Mechanism
---------

SourceHook replaces methods within a class's virtual table to redirect execution to SourceHook itself. Virtual hooking is comparatively simple compared to detours; all a hooking library needs to do is ensure ABI compatibility with the method being swapped. Detours, on the other hand, require disassembling the first block of a subroutine to generate a trampoline that executes the original code!

Compatibility
-------------

Compatibility for arguments is fairly trivial--you just need to have the right type and pointer type (eg, lvalue ref, rvalue ref, pointer, pass-by-value...)

For return types, it gets a bit tricky. For 64-bit support, you need to make sure that your return type exactly matches the type in the game, or else different code could be emitted by your compiler that is incompatible with the game.

Implementation
--------------

SourceHook is split into two parts: the **implementation** (within metamod itself) and the **hook manager** (within your plugin!) The implementation keeps track of all plugins that are trying to hook a particular method, and the hook manager is responsible for calling each plugin's hook. Your plugin's SourceHook macros or templates create a hook manager for the method being hooked, and this hook manager directly replaces the original implementation in the virtual table.

Only one plugin's hook manager is used. When there are multiple, SourceHook picks the first one, prioritizing newer hook manager version numbers for compatibility. Even if an old plugin that no longer supports the current SourceHook implementation is running on the system, as long as a newer hook manager exists SourceHook will use it instead, providing fairly remarkable compatibility. (The plugins themselves, on the other hand...)

This also means if even one hook manager is out of date and no longer has ABI compatibility with the original, then crashes could occur.