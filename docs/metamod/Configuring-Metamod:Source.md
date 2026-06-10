# Configuring Metamod:Source - AlliedModders Wiki
This article briefly overviews the basics of configuring a [Metamod:Source](https://wiki.alliedmods.net/Metamod:Source "Metamod:Source") installation.

For information on unloading, loading, and refreshing plugins, see [meta console](https://wiki.alliedmods.net/Console_Commands_\(SourceMM\) "Console Commands (SourceMM)") commands instead.

This documentation describes how to add configure Metamod:Source's loading of plugins. You will need to refer to your plugin's documentation for additional installation or configuration information.

Contents
--------

*   [1 Plugins](#Plugins)
    *   [1.1 Aliases](#Aliases)
*   [2 Settings](#Settings)

Plugins
-------

As of Metamod:Source 1.4.3, there is a new plugin loading method using .vdf files. These files are placed in the addons/metamod folder. Check your plugin's documentation to see if it comes with one of these files; if it does not, you will need to follow the directions below to load it.

1.  Open (or create) the "addons/metamod/metaplugins.ini" file in your mod folder (such as "cstrike" or "hl2mp"). You must use a plain text editor. If you use Notepad, make sure to save as "All Files" or else it may add an erroneous .txt extension.
2.  Add a line to metaplugins.ini which points to the plugin's path. For example, if the plugin is in cstrike\\addons\\sourcemod\\bin\\sourcemod\_mm\_i486.so, you would add:
    
    ```
addons\sourcemod\bin\sourcemod_mm
```

    
    Note that you do not need to worry about the file extension or operating system - all you need is the relative path to the file. If you add an extension, it won't hurt, but it's auto-detected regardless.
3.  Save the file and either restart the server, change the map, or type "meta refresh" in the console. You can manually use "meta load" but the plugin may require a map change

To remove a plugin, simply comment it from the list, using a semicolon (;) character, or by removing the line entirely.

Aliases
-------

As of Metamod:Source 1.2.2, you can "alias" plugins to file names. This lets you specify an alias wherever you would specify a plugin file. In metaplugins.ini it would look like this:

```
sourcemod addons\sourcemod\bin\sourcemod_mm
```


Here, "sourcemod" is now defined as an alias for "addons\\sourcemod\\bin\\sourcemod\_mm" which is useful if you wish to unload a plugin and then load it again without needing to type a long file path.

If the plugin path contains a space and you wish to create an alias, you do not need quotes. However, a non-alias path will be misread as an alias. In this case, you must use quotes:

```
"addons\My Plugin\bin\My Plugin.dll"
```


Settings
--------

Metamod:Source has two cvars for configuring where it looks for plugins. They must be set as both cvars (for example, via autoexec.cfg) and as a command line parameter.

*   mm\_pluginsfile - Sets which file contains the plugins list. Defaults to "addons/metamod/metaplugins.ini".
*   mm\_basedir - Sets the root folder for MM:S. Defaults to "addons/metamod". This can be used to change where .vdf are searched.

Example of a server command line:

```
srcds.exe -game cstrike +maxplayers 12 +map de_dust +mm_basedir "server1/metamod"
```
