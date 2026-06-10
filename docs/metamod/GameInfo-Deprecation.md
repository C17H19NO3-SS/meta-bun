# Gameinfo Deprecation - AlliedModders Wiki
  
Metamod:Source versions 1.4.3 and 1.6.0 officially deprecated the gameinfo.txt installation mechanism in support for loading as a Valve Server Plugin. This has a few implications for both users and developers, which are explained in this article.

Contents
--------

*   [1 Users](#Users)
*   [2 Developers](#Developers)
*   [3 FAQ](#FAQ)
    *   [3.1 Can I unload Metamod:Source now?](#Can_I_unload_Metamod:Source_now.3F)
    *   [3.2 Can I late-load Metamod:Source now?](#Can_I_late-load_Metamod:Source_now.3F)
    *   [3.3 Does this mean MM:S plugins are VSPs?](#Does_this_mean_MM:S_plugins_are_VSPs.3F)
    *   [3.4 Does this mean I can finally change the MM:S binary name?](#Does_this_mean_I_can_finally_change_the_MM:S_binary_name.3F)
    *   [3.5 Are any features lost from the VSP version?](#Are_any_features_lost_from_the_VSP_version.3F)

Users
-----

By not using gameinfo.txt, Metamod:Source will no longer break on minor updates, and will not require any intervention on behalf of server administrators.

We formed a beta testing group for this release, and the new Metamod:Source loading mechanism seemed to work across the most popular plugins. However, it is possible that a plugin was written such that it will no longer be compatible with the new mechanism. If you switch to the new loading mechanism and a plugin stops working, post on the [forums](http://forums.alliedmods.net/forumdisplay.php?f=74) explaining the problem. Most likely you will have to switch to the old gameinfo.txt method until the plugin's author can correct the issue.

Developers
----------

Your plugin's ISmmPlugin::Load callback now occurs later in the server startup process. This means you can't hook functions like ICvar::RegisterConCommandBase and expect to see calls from the game pass through. It also means you can't intercept the game's factory calls (which would be a silly idea anyway). We could not find any public plugins that did this.

The "late load" parameter is still false. Your plugin won't be able to tell when it is loaded in Valve Server Plugin mode, so you should code assuming that the gameinfo.txt pre-emption is not available (unless you explicitly tell your users that modifying gameinfo.txt is a requirement).

Unfortunately, we could not add VSP mode detection because it would bump the 1.4 branch's API version, which is frozen. We may consider adding it in the future though -- if it's something that you need, please file a feature request.

FAQ
---

### Can I unload Metamod:Source now?

No. Don't try; you will get an error message and then MM:S will force your server to quit to avoid a delayed crash. Metamod:Source cannot be unloaded for technical reasons, and if you're interested why, I can write an entry on my blog. This feature will never be added so do not ask for it. You can simply use "meta unload" to unload individual plugins.

### Can I late-load Metamod:Source now?

Surprisingly, yes! You must change the map first but I have made sure that it works.

### Does this mean MM:S plugins are VSPs?

No. It simply means MM:S is easier to install and maintain since the loading mechanism doesn't get broken from running the Steam update tool. We continue to hold that Metamod:Source itself offers a much more viable plugin developing framework than Valve Server Plugins, and our own plugins (such as SourceMod) will continue to require Metamod:Source.

### Does this mean I can finally change the MM:S binary name?

You are more than welcome to do that. We will keep distributing it as "server" so people can continue to use the gameinfo.txt mechanism.

### Are any features lost from the VSP version?

Technically, yes. When loading as a GameDLL via gameinfo.txt, Metamod:Source has a chance to intercept factories that the Engine gives the Game upon loading. Of course, there isn't really a necessary reason to intercept that - everything that passes between the Game and Engine is a virtual interface, and thus hookable via SourceHook. Furthermore, there are all sorts of dangers in tricking the Engine/Game into receiving alternate interface implementations, the most obvious being the loss of unloadability. So we're fairly confident that no plugins do anything like this, and if you're a developer, you shouldn't do it.