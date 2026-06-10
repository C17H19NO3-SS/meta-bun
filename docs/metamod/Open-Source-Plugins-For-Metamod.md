# Open Source Plugins for Metamod:Source - AlliedModders Wiki
Contents
--------

*   [1 Open Source Plugins for Metamod:Source](#Open_Source_Plugins_for_Metamod:Source)
    *   [1.1 Basic Templates](#Basic_Templates)
        *   [1.1.1 stub\_mm](#stub_mm)
        *   [1.1.2 sample\_mm](#sample_mm)
        *   [1.1.3 sample2\_mm](#sample2_mm)
    *   [1.2 Functional Plugins](#Functional_Plugins)
        *   [1.2.1 Anti-Griefer](#Anti-Griefer)
        *   [1.2.2 Basic Admin Tool (BAT)](#Basic_Admin_Tool_.28BAT.29)
        *   [1.2.3 Counter Strike Bot Control](#Counter_Strike_Bot_Control)
        *   [1.2.4 CS:S Weapon Restrictions 2](#CS:S_Weapon_Restrictions_2)
        *   [1.2.5 ForgiveTK](#ForgiveTK)
        *   [1.2.6 Global Banlist](#Global_Banlist)
        *   [1.2.7 HLStatsX ( Allows srcds to interact with hlstatsx ingame)](#HLStatsX_.28_Allows_srcds_to_interact_with_hlstatsx_ingame.29)
        *   [1.2.8 IRC Relay](#IRC_Relay)
        *   [1.2.9 Last Users Connected](#Last_Users_Connected)
        *   [1.2.10 SourceMod](#SourceMod)
        *   [1.2.11 Stripper:Source](#Stripper:Source)
        *   [1.2.12 ServerWiper](#ServerWiper)
        *   [1.2.13 ServerBans](#ServerBans)
*   [2 Open Source Valve Server Plugins (VSP)](#Open_Source_Valve_Server_Plugins_.28VSP.29)

Open Source Plugins for Metamod:Source
--------------------------------------

This page lists known plugins with available source code. Please check the licenses for each one as they may not truly be "open source."

Basic Templates
---------------

### stub\_mm

**Author:** [BAILOPAN](https://wiki.alliedmods.net/User:BAILOPAN "User:BAILOPAN")  
**Description:** minmum implentation of a valid Metamod:Source plugin  
**Features:** starting template  
**Download:** Included in the Metamod:Source source code package: [www.sourcemm.net](http://www.sourcemm.net/)

### sample\_mm

**Author:** [BAILOPAN](https://wiki.alliedmods.net/User:BAILOPAN "User:BAILOPAN")  
**Description:** implements the features of the standard Valve server plugin from the SDK  
**Features:** starting template with similar functionality to the Valve sample\_plugin  
**Download:** Included in the Metamod:Source source code package: [www.sourcemm.net](http://www.sourcemm.net/)

### sample2\_mm

**Author:** [BAILOPAN](https://wiki.alliedmods.net/User:BAILOPAN "User:BAILOPAN"), edited by [L. Duke](https://wiki.alliedmods.net/User:L._Duke "User:L. Duke")  
**Description:** fixes (by inheriting from IGameEventListener2 instead of hooking FireGameEvent) the problem in sample\_mm plugin where some events are not received  
**Features:** starting template with similar functionality to the Valve sample\_plugin  
**Download:** [forums.alliedmods.net/showthread.php?p=342749](http://forums.alliedmods.net/showthread.php?p=342749) (you must be logged in to view the download link)

Functional Plugins
------------------

### Anti-Griefer

**Author:** [devicenull](https://wiki.alliedmods.net/index.php?title=User:Devicenull&action=edit&redlink=1 "User:Devicenull (page does not exist)")  
**Description:** This plugin is for the mod SourceForts. In keeps track of what player unfreezes or freezes a block, and allows any other player to retrieve this information by aiming at a block.  
**Features:** Basic VFuncs, listening for events, partial traceline (The method used for traceline might not be effective for any other mod)  
**Download:** [http://www.sourcemod.net/forums/viewtopic.php?t=3652](http://www.sourcemod.net/forums/viewtopic.php?t=3652)

### Basic Admin Tool (BAT)

### Counter Strike Bot Control

**Author:** [EKS](https://wiki.alliedmods.net/index.php?title=User:EKS&action=edit&redlink=1 "User:EKS (page does not exist)")  
**Description:** This plugin allows you to control the counter strike source bots more easly, you can have them them automaticly keep the server populated. You can have bots automaticly killed when all the human players are dead, and any changes can be made in the bot menu.  
**Features:** Control the built in bots in CSS via a menu  
**Download:** [http://forums.alliedmods.net/showthread.php?t=40097](http://forums.alliedmods.net/showthread.php?t=40097)

### CS:S Weapon Restrictions 2

**Author:** [L. Duke](https://wiki.alliedmods.net/User:L._Duke "User:L. Duke")  
**Description:** Prevents players from picking up restricted weapons (if bought, they fall to the ground). Also includes an option to remove restricted weapons from the game.  
**Features:** Hook _CCSPlayer::Weapon\_CanUse(CBaseCombatWeapon \*pWeapon)_ and returns false for restricted weapons. Also shows how to use virtual functions on weapons such as Delete()and GetName() and on players for Weapon\_GetSlot(int) and Drop(CBaseCombatWeapon\*).  
**Download:** [forums.alliedmods.net/showthread.php?p=342750](http://forums.alliedmods.net/showthread.php?p=342750)

### ForgiveTK

**Author:** [EKS](https://wiki.alliedmods.net/index.php?title=User:EKS&action=edit&redlink=1 "User:EKS (page does not exist)")  
**Description:** This is a basic plugin to handle teamkilll and teamattack on your source server, it supports any Source mod. It will automaticly kick someone with to many offenses  
**Features:** Forgive via menu or chat. Support both Valves ESC menus and radio menus.  
**Download:** [http://www.sourcemod.net/forums/viewtopic.php?t=3081](http://www.sourcemod.net/forums/viewtopic.php?t=3081)

### Global Banlist

**Author:** [devicenull](https://wiki.alliedmods.net/index.php?title=User:Devicenull&action=edit&redlink=1 "User:Devicenull (page does not exist)")  
**Description:** This plugin allows srcds to reguarly connect to an external PHP page, and download updates about it's banlist. Srcds then stores these in a SQLite database.  
**Features:** Embedding sqlite, using pthreads, using libcurl.  
**Download:** [http://www.sourcemod.net/forums/viewtopic.php?t=3539](http://www.sourcemod.net/forums/viewtopic.php?t=3539)

### HLStatsX ( Allows srcds to interact with hlstatsx ingame)

### IRC Relay

**Author:** [sslice](https://wiki.alliedmods.net/User:Sslice "User:Sslice")  
**Description:** Reports game events to an IRC channel and allows you to administrate your server from IRC  
**Features:** ConCommand hooks and general networking using asynchronous sockets  
**Download:** [AlliedModders](http://forums.alliedmods.net/showthread.php?t=39395)

### Last Users Connected

**Author:** [devicenull](https://wiki.alliedmods.net/index.php?title=User:Devicenull&action=edit&redlink=1 "User:Devicenull (page does not exist)")  
**Description:** With this plugin, every player who comes onto your server has their steamid logged, along with any name they used on the server. You can then either view the names/steamid's of the last people to disconnect, or you can search for a name/steamid and see everyone who has used that name.  
**Features:** shows how to embed sqlite3, send basic messages/basic hooks.  
**Download:** [http://www.sourcemod.net/forums/viewtopic.php?t=3339](http://www.sourcemod.net/forums/viewtopic.php?t=3339)

### SourceMod

**Author:** AlliedModders LLC  
**Description:** Administration and scripting plugin.  
**Features:** Fine-grained administrative permissions. Flexible scripting and HL2SDK interop. Extensible from C++ extensions.  
**Download:** [www.sourcemod.net](http://www.sourcemod.net/)

### Stripper:Source

**Author:** [BAILOPAN](https://wiki.alliedmods.net/User:BAILOPAN "User:BAILOPAN")  
**Description:** You can add any type of entity - hostage, spawn point, physics prop, permanently to the map. You can also filter out entities for deletion, either by specific entries or regular expressions. Stripper:Source lets you define global rules and per-map rules. It also lets other plugins (both SourceMM plugins and Server Plugins) use its API.  
**Features:** shows how to edit the map entity lump in memory to change map entities  
**Download:** [www.sourcemod.net/forums/viewtopic.php?t=3008](http://www.sourcemod.net/forums/viewtopic.php?t=3008)

### ServerWiper

**Author:** [Jmgr](https://wiki.alliedmods.net/index.php?title=User:Jmgr&action=edit&redlink=1 "User:Jmgr (page does not exist)")  
**Description:** The ServerWiper is a behaviour watcher plugin Counter Strike:Source servers. It works with a behaviour point system. If you do something bad (insult, team attack, etc.) you lose points. If you have 0 points you are banned from the server.  
**Features:** kicks and bans players with bad behaviour, more than 150 CVars  
**Download:** [http://sw.jmgr.info](http://sw.jmgr.info/)

### ServerBans

**Author:** [Jmgr](https://wiki.alliedmods.net/index.php?title=User:Jmgr&action=edit&redlink=1 "User:Jmgr (page does not exist)")  
**Description:** ServerBans is a plugin that allows server admin to automatically share bans between multiple servers.  
**Features:** Compatible with almost every game/mod and plugin, little dependencies (Metamod:Source and MySQL)  
**Download:** [http://forums.alliedmods.net/showthread.php?t=90428](http://forums.alliedmods.net/showthread.php?t=90428)

Open Source Valve Server Plugins (VSP)
--------------------------------------

A list of open source plugins for the Valve Server Plugin (VSP) interface can be found [here](http://developer.valvesoftware.com/wiki/List_of_Open_Source_Server_Plugins).