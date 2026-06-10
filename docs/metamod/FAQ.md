# Frequently Asked Questions (Metamod:Source) - AlliedModders Wiki
Contents
--------

*   [1 Frequently Asked Questions](#Frequently_Asked_Questions)
    *   [1.1 Q: Does Metamod:Source support (some) mod?](#Q:_Does_Metamod:Source_support_.28some.29_mod.3F)
    *   [1.2 Q: How do I install Metamod:Source?](#Q:_How_do_I_install_Metamod:Source.3F)
    *   [1.3 Q: Does Metamod: Source Create Lag?](#Q:_Does_Metamod:_Source_Create_Lag.3F)
    *   [1.4 Q: Will Server Plugins run on Metamod: Source?](#Q:_Will_Server_Plugins_run_on_Metamod:_Source.3F)
    *   [1.5 Q: Is there a tutorial/example of how to write a Metamod:Source plugin?](#Q:_Is_there_a_tutorial.2Fexample_of_how_to_write_a_Metamod:Source_plugin.3F)
    *   [1.6 Q: If I create a Metamod:Source plugin, does it have to be open source?](#Q:_If_I_create_a_Metamod:Source_plugin.2C_does_it_have_to_be_open_source.3F)
    *   [1.7 Q: Can you port this to another game engine?](#Q:_Can_you_port_this_to_another_game_engine.3F)
    *   [1.8 Q: How does it work? Like Metamod-P?](#Q:_How_does_it_work.3F_Like_Metamod-P.3F)
    *   [1.9 Q: What's the difference between SourceMM and Metamod:Source?](#Q:_What.27s_the_difference_between_SourceMM_and_Metamod:Source.3F)
    *   [1.10 Q: Where can I find more about SourceHook?](#Q:_Where_can_I_find_more_about_SourceHook.3F)

Frequently Asked Questions
--------------------------

##### Q: Does Metamod:Source support (some) mod?

Metamod:Source only requests the core public interfaces of Source, so it will run on all mods that work with the version of Half-Life 2 it was built for. However, this may not strictly be true depending upon which Metamod:Source API functions a plugin uses. See the [supported games](https://wiki.alliedmods.net/Supported_Games_\(SourceMM\) "Supported Games (SourceMM)") list for more details.

##### Q: How do I install Metamod:Source?

Please look in the [Installation](https://wiki.alliedmods.net/Installing_Metamod:Source "Installing Metamod:Source") section of the documentation.

##### Q: Does Metamod: Source Create Lag?

No. Metamod:Source is based off a library called SourceHook. Unlike the original Metamod for Half-Life 1, Metamod:Source only hooks functions when asked to by a plugin. It does not intercept every call by default, and does not require a complex routing table for unused hooks.

In non-technical terms? [Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source") is only there when you need it to be. The hooking method, although complicated, is very efficient and takes advantage of some of the odder features of C++.

And unlike the original Metamod, the binary is one tenth the size - the Half-Life 2 engine does not require a massive repository of linked entities to be exported in the same way Half-Life 1 did.

##### Q: Will Server Plugins run on Metamod: Source?

No. Metamod:Source plugins are separate. You can run them side by side, as long as the server plugins do not have any compatibility issues or private hooks that interfere.

##### Q: Is there a tutorial/example of how to write a Metamod:Source plugin?

Yes, look in the source code for "stub\_mm" and "sample\_mm", which contain examples of how to use the Metamod:Source API. You should be familiar with C++ and the Half-Life 2 SDK in order to proceed.

##### Q: If I create a Metamod:Source plugin, does it have to be open source?

No. Unlike the original Metamod, we decided to use the libpng/zLib license instead of the GPL. This is because Valve does not impose the same restrictions on Server Plugins. We'd like to keep the playing field level, as well as provide everyone with the same freedom and opportunities.

##### Q: Can you port this to another game engine?

Every game engine is different. Currently Metamods have been developed for three major game engines: The original Metamod for Half-Life 1 (by Will Day), Quake3 MultiMod (by CyberMind), and Metamod:Source (what you're reading about now). Each one needs to be carefully designed and built upon a specific set of rules, so a direct port is usually not possible. However, Metamod:Source is built upon a library called SourceHook. SourceHook provides a fast, efficient, and simple way to create virtual hooks. Any game that uses a modern virtual interface design for engine calls can take advantage of SourceHook.

##### Q: How does it work? Like Metamod-P?

No. Metamod-P is a highly optimized version of Metamod for Half-Life 1 created by Jussi Kivilinna. By using dynamic link patching, it is able to resolve entity export differences between the Engine and GameDLL - this means it does not require updates for mods like the original Metamod. It also has other related optimization techniques.

Metamod: Source is different because it uses virtual function hooking - which means individual functions in classes can be dynamically altered. Half-Life 1's engine functions were passed as a list of pointers in a struct, which requires an entirely different method of interception (that is, a wrapper set of functions that act as a router to the plugins). You can think of the design in this way:

Metamod: The Engine gives the GameDLL its set of functions, and the GameDLL gives the Engine its set of functions. Metamod sits in between and actually exchanges false versions, which have new functions that allow you to decide whether to override the original calls. Metamod: Source: You can take any virtual function of a known class and declare a hook on it. The hook is applied by patching memory directly, at runtime. The only interception that occurs between the GameDLL and Engine is the factories which provide class retrieval.

##### Q: What's the difference between SourceMM and Metamod:Source?

We no longer use the name "SourceMM." It was getting too confused with "SourceMod," another AlliedModders project.

##### Q: Where can I find more about SourceHook?

See [SourceHook Development](https://wiki.alliedmods.net/SourceHook_Development "SourceHook Development").