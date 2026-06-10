# Installing Metamod:Source - AlliedModders Wiki
This article will guide you through a [Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source") installation.

Contents
--------

*   [1 Normal Installation](#Normal_Installation)
    *   [1.1 Custom VDF File](#Custom_VDF_File)
*   [2 Adjust gameinfo file](#Adjust_gameinfo_file)
    *   [2.1 Source 1](#Source_1)
    *   [2.2 Source 2](#Source_2)

Normal Installation
-------------------

_Not applicable for Source 2. See GameInfo section below_

Valve sometimes makes changes in their games that break Metamod:Source between releases. When this happens, you may need to install a snapshot versions of Metamod:Source. You can see if this is required on the [Required Versions](https://wiki.alliedmods.net/Required_Versions_\(SourceMod\) "Required Versions (SourceMod)") page.

1.  [Download](http://www.metamodsource.net/) Metamod:Source.
2.  Extract the package to your game folder. For example, for Counter-Strike:Source, you would have `cstrike/addons/metamod` after extracting. If you are uploading to FTP, extract the files locally before transferring to your server's game folder.
3.  Restart your server.
4.  Type "meta version" in your server console (or RCon). You should see a line like: "Loaded As: Valve Server Plugin." If you see this, you are done. If the command is not recognized, see the sections below.

When using a Linux server, you may see the following messages:

*   An error indicating that it could not be loaded due to "wrong ELF class: ELFCLASS64". If you are using a 32-bit dedicated server installation, this is normal behavior; as long as `meta version` is recognized, Metamod:Source is installed.
*   An error indicating that it could not be loaded because "/path/to/server\_install/bin/libgcc\_s.so.1: version \`GCC\_7.0.0\` not found (required by /some\_system\_path\_to/libstdc++.so.6". This is because Valve ships their own copies of those libraries. As modern systems will have newer versions, you can safely delete the listed file from the server install. Do not delete the file in the system path (usually `lib` or `lib32`).
*   If you are running a 64-bit operating system yourself, you may need to install the system's 32-bit libraries.
    *   On Debian / Ubuntu, you can do this with `apt install gcc-multilib`.
*   You may find more information about any load failures under a `metamod-fatal.log` in metamod's `bin` folder.

Custom VDF File
---------------

**Note: This is normally not needed - Metamod:Source 1.10.0 and later include a `metamod.vdf` file for easier installation on most games.**

You really, really do not need to do this.

Known setups that require this step:

1.  Left 4 Dead 1
2.  3rd party mods using the Source SDK Base.
3.  Listen servers (created with the in-game "Create Server" option) for non-english game clients.

If you are running any of the above, then yes, you probably do need it. But you probably aren't, so you probably don't, and plenty of people have fallen into the trap of doing these steps unnecessarily and have had to be told otherwise.

So again, if you followed the normal installation process above and `meta version` was recognized, _do not do this_.

Otherwise, if you have trouble getting Metamod:Source to load, [go here](http://www.metamodsource.net/?go=vdf) to generate a VDF file specific to your game. This file should be placed into your server's `addons` directory.

Adjust gameinfo file
--------------------

**Adjusting gameinfo for Source 1 is normally not needed. If you do not understand what this is, do NOT do this unless instructed to. The above instructions are sufficient to install Metamod:Source for 99% of servers. For Source 2, this is, however, the only supported loading method. See [Source 2](#Source_2) for more info.**

Source 1
--------

Metamod:Source 1.4.2 and lower used an older method for loading itself. The advantage of this method was that Metamod:Source could be loaded before the actual game mod, which gave it a small amount of extra functionality. This functionality was never used by plugin developers, and Steam updates kept overwriting `gameinfo` files, so we switched to a different loading mechanism.

However this loading mechanism may still be desirable if you run into backwards compatibility issues, or you have a plugin which takes advantage of the early-loading mechanism. If this is your case, here are the `gameinfo` directions below:

*   Open the file in the mod folder called `gameinfo.txt`. You will see a few lines at the bottom like this:
    
    ```
SearchPaths
{
	Game				|gameinfo_path|. 
	Game				cstrike
	Game				hl2
}

```

    
*   Add a line after the `{` sign but before all of the `Game` entries that looks like this:
    
    ```
GameBin				|gameinfo_path|addons/metamod/bin

```

    
*   If you're using Windows, you may need to use a backwards slash (\\) instead.
*   You're done! To test whether it worked, restart your game server and type `meta version` in the server console. You should see a line that says `Loaded as: GameDLL (gameinfo.txt)`. If it doesn't recognize the command, the installation probably failed. If the `Loaded as:` line says something else, `gameinfo` was probably not modified correctly.
*   For more information or documentation, see [Category:Metamod:Source Documentation](https://wiki.alliedmods.net/Category:Metamod:Source_Documentation "Category:Metamod:Source Documentation")

Source 2
--------

Source 2 does not have server plugins, so you will need to load Metamod the old-fashioned way: replacing the server library with Metamod's stub loader.

![](https://wiki.alliedmods.net/images/thumb/Sadness.png/32px-Sadness.png)

You will need to redo these changes every time a developer pushes a change that modifies gameinfo.gi

*   Open the file in the mod folder called `gameinfo.gi`. In CS2 this is `csgo/gameinfo.gi`.
*   Note that even though it says `DO NOT EDIT THIS FILE DIRECTLY` and advises to edit `csgo_core/gameinfo.gi`, editing that file does not correctly load Metamod.
*   Look for the `SearchPaths` section of code.
*   Add a line after the `{` sign but before all of the `Game` entries that looks like this, replacing `csgo` (for CS2) with your game name found in lines beneath it:
    
    ```
Game csgo/addons/metamod
```

    
    ![](https://wiki.alliedmods.net/images/thumb/Silly_goose.png/32px-Silly_goose.png)
    
    Make sure the Metamod entry is the **first** in the searchpaths list! This list is ordered and placing it anywhere else will prevent Metamod from loading
    
*   Using `GameBin` instead of `Game` does not work.
*   In Windows, the backslash is no longer required for paths.
*   You're done! To test whether it worked, restart your game server and type `meta version` in the server console. You should see a line that says `Metamod:Source version 2.x.x`. If it doesn't recognize the command, the installation probably failed. Try updating your game to the latest version and using the latest version of Source 2.
*   For more information or documentation, see [Category:Metamod:Source Documentation](https://wiki.alliedmods.net/Category:Metamod:Source_Documentation "Category:Metamod:Source Documentation")