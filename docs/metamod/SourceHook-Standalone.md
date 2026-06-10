# SourceHook Standalone - AlliedModders Wiki
SourceHook can be embedded and run standalone of Metamod if you want to integrate it into another platform. SourceHook independent of metamod is a lightweight and powerful instrumentation library for polymorphic C++ classes, and comes with many features needed to implement your own C++ modding platform out-of-the-box.

To make sure SourceHook's conflict resolution is able to run unimpeded, you need to make sure only one instance of SourceHook exists in the entire process! Once the global SourceHook implementation has been created, you can pass the ISourceHook pointer around to allow plugins to interface with SourceHook.

Usage
-----

Each hook has an associated g\_PLID/PluginId that groups hooks from the same plugin together. The g\_PLID doesn't need to be anything particularly; SourceHook doesn't care, it's just sugar that allows you to de-register, pause, and unpause entire plugins remotely.

In all consuming plugins, g\_PLID should be provided and tracked by whatever management code you have, and ISourceHook::UnloadPlugin should be called with the corresponding PluginId when a plugin is being unloaded.

Examples
--------

To instantiate the SourceHook engine, you must create a CSourceHookImpl instance. Example:

```
/* Normally, just <sourcehook.h> is included, but this is needed to instantiate the engine. */
#include <sourcehook/sourcehook_impl.h>
 
SourceHook::Impl::CSourceHookImpl g_SourceHook;
```


To actually use SourceHook, it is necessary to have two global variables:

*   g\_PLID - A unique integer that identifies the library using SourceHook. This is used for removing all hooks a library is using.
*   g\_SHPtr - A pointer to the SourceHook::ISourceHook interface.

Example header file:

```
#include <sourcehook/sourcehook.h>
 
extern SourceHook::ISourceHook *g_SHPtr;
extern int g_PLID;
```


Example addition to the global code:

```
SourceHook::ISourceHook *g_SHPtr = &g_SourceHook;
int g_PLID = 0;
```


Multiple Libraries/Shared Hooks
-------------------------------

If SourceHook is going to be used across multiple libraries in the same process, it is essential that only one instance of SourceHook be present. Of course, that is only logical, since otherwise the instances would be replacing each other's virtual patches.

In order to support this, each separate library must be given the ISourceHook pointer and a unique g\_PLID value. CSourceHookImpl provides a few useful functions for managing hooks on "child" libraries or otherwise linked code.

*   PausePlugin() - Silences any hooks from an ID, such that those hooks will not be called.
*   UnpausePlugin() - Un-silences any silenced hooks from an ID.
*   UnloadPlugin() - Clean-up any left-over hooks from an ID.