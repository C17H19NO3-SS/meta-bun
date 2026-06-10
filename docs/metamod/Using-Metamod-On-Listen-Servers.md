# Using Metamod:Source on Listen Servers - AlliedModders Wiki
Contents
--------

*   [1 Launch option](#Launch_option)
*   [2 Old Metamod versions](#Old_Metamod_versions)
    *   [2.1 First Steps](#First_Steps)
    *   [2.2 Using the Launcher](#Using_the_Launcher)
    *   [2.3 Starting Problems](#Starting_Problems)
*   [3 External Links](#External_Links)

Launch option
-------------

Since the [September 8, 2010 Patch](http://wiki.teamfortress.com/wiki/September_8,_2010_Patch) it is necessary to add -insecure to the launch options to load third party plugins like Metamod.

The launch option must be removed again to join other (secure) servers. So for convenience it might be best to create suitable desktop short cuts.

Old Metamod versions
--------------------

**Note:** The instructions below are only intended for users of older Metamod:Source versions (1.4.2 or lower), which do not support the newer [loading mechanism](https://wiki.alliedmods.net/Installing_Metamod:Source "Installing Metamod:Source"). If you are using Metamod:Source 1.4.3+ or higher and you are using a metamod.vdf file, these instructions do not apply to you.

First Steps
-----------

To run your Source listen server with [Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source"), you need to install [Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source") with the [automated installer](https://wiki.alliedmods.net/Installing_SourceMM "Installing SourceMM") or simply download the latest version of the launcher from [SVN](http://svn.alliedmods.net/viewvc.cgi/trunk/installer/HL2Launch.exe?root=sourcemm&view=log). If you decide to use the binary from SVN, copy the file into your server's game directory (the directory where you can find the game's hl2.exe).

Using the Launcher
------------------

Before you can use the launcher, make sure Steam is already started. Once you know it is, you only need to start "hl2launch.exe" in your game directory. You can also specify (typical) Counter-Strike:Source parameters like "-console" or simply create a link to it on your desktop.

Starting Problems
-----------------

When you use this tool, always make sure Steam is already running. If that's the case and you get an error message when starting your game with the launcher, try to run it once from the Steam Games menu and start it again with the tool.

External Links
--------------

[Metamod:Source](http://www.metamodsource.net/)