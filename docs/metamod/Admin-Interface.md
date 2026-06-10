# AdminInterface (Metamod:Source) - AlliedModders Wiki
Contents
--------

*   [1 Introduction](#Introduction)
*   [2 What Admin plugins support it](#What_Admin_plugins_support_it)
*   [3 What plugins use this interface](#What_plugins_use_this_interface)
*   [4 How do I use the AdminInterface in my plugin](#How_do_I_use_the_AdminInterface_in_my_plugin)
    *   [4.1 Getting started](#Getting_started)
    *   [4.2 Using the interface](#Using_the_interface)
    *   [4.3 Pre defined access rights](#Pre_defined_access_rights)
*   [5 How do I add the AdminInterface in my plugin](#How_do_I_add_the_AdminInterface_in_my_plugin)

Introduction
------------

AdminInterface is a interface that allows sourcemm plugins to interact with admin plugins like [Basic Admin Tool](http://forums.alliedmods.net/showthread.php?t=39356) / [Mani (Support comming in a upcomming version)](http://www.mani-admin-plugin.com/) to get the current admin rights of the players. It also allows the plugins to register custom access rights for their plugin. This interface was made so smaller plugins, that may need admin rights for something simple dont need to make a system where the admin have to setup user rights for ever plugin. But instead can setup admin right in the admin plugin he preferes and the other plugins can get the information they need for it.

_Note: AdminInterface is NOT created or maintained by the team behing Sourcemm /Amxmodx, its a interface created by a 3dparty and is kindly hosted on this wiki_

What Admin plugins support it
-----------------------------

[Basic Admin Tool](http://www.thexsoft.com/index.php?page=basic-admin-tool)  
[Mani](http://www.mani-admin-plugin.com/)  

_If you have a admin plugin that supports has support for the AdminInterface edit this page._

What plugins use this interface
-------------------------------

[HPK](http://www.thexsoft.com/index.php?page=high-ping-kicker) - This plugin kicks players with a high ping.  
[ForgiveTK](http://forums.alliedmods.net/showthread.php?t=39511) - This plugin adds a simple TK system to any source server, so players can forgive teamkills & teamattacks.  
[CS Bot Control](http://forums.alliedmods.net/showthread.php?t=40097) - A plugin to easly manage the CS bots, with a handy menu  
[Sharedbans Spectator ESP (Source)](http://forums.alliedmods.net/showthread.php?t=40089) - This plugin allows admins/players who are spectating/dead and are in first person view of another player to see the enemies (and teammates) of that player through the walls. This may help to catch wallhackers  
[Clanmatch-Plugin](http://www.siekhe-trophy.de/forum/viewtopic.php?t=669) A plugin to making controling a clan server more easy  

_If you have a plugin that uses the interface, feel free to add it here._

How do I use the AdminInterface in my plugin
--------------------------------------------

The following example is taken directly out of the [ForgiveTK](http://forums.alliedmods.net/showthread.php?t=39511) plugin, and this plugin offcourse is based of the sourcemm sample plugins. The soucemm sample plugins have this AllPluginsLoaded() function, this is a good time to check to see if you can find the AdminInterface, incase your plugin is loaded before the admin plugin.

Getting started
---------------

Before you start coding, you should get the AdminInterface.h file, you can get this file easy from [Basic Admin Tool](http://forums.alliedmods.net/showthread.php?t=39356) source ( in hl2sdk/batinterface.h ).

```
AdminInterface *m_AdminManager;

void ForgiveTK::AllPluginsLoaded()
{
	if(m_AdminManager) // We dont need to find the AdminInterface again, we allready found it once.
		return;

	//we don't really need this for anything other than interplugin communication
	//and that's not used in this plugin.
	//If we really wanted, we could override the factories so other plugins can request
	// interfaces we make.  In this callback, the plugin could be assured that either
	// the interfaces it requires were either loaded in another plugin or not.
	PluginId id2; 

	void *ptr = g_SMAPI->MetaFactory("AdminInterface", NULL, &id2); 
	
	if (!ptr) 
	{
		ServerCommand("echo Did not find AdminInterface, plugin will not check admin rights"); 
	} else {
		m_AdminManager = (AdminInterface *)ptr;
		m_AdminManager->AddEventListner(this);
		int InterfaceVersion = m_AdminManager->GetInterfaceVersion();
		
		if(InterfaceVersion == ADMININTERFACE_VERSION)
			ServerCommand("echo Found AdminInterface[%d] at (%p), via %s (Interface version: %d)", id2, ptr,m_AdminManager->GetModName(),InterfaceVersion); 
		else
			ServerCommand("echo Found AdminInterface[%d] at (%p), but interface was NOT the expected version: Was %d Expected %d, this can create problems. Please update the plugin with the lowest interface version", id2, ptr,m_AdminManager->GetModName(),InterfaceVersion,ADMININTERFACE_VERSION); 
	}
}
void ForgiveTK::Client_Authorized(int id) // This is called when a client is fully connected and authed by the admin tool, this normaly happens after the client has gotten a valid steamid & the admin tool has checked it against its internal user lists.
{
	ServerCommand("echo Client_Authorized: %d",id);
}
void ForgiveTK::OnAdminInterfaceUnload() // Called when the admin interface is getting unloaded, this happens if a admin uses meta unload or the server is shutting down.
{
	m_AdminManager = NULL;
	ServerCommand("echo AdminInterface was unloaded");
}

```


Its importent that you setup a callback to your plugin, when use the interface so the admin plugin can inform you plugin when its being unloaded.

Using the interface
-------------------

The following function bellow would check if a user has a admin right equal to "immunity" and return true if thats the case.

```
bool ForgiveTK::HasAdminImmunity(int id) // Checks if the user has a admin right "immunity"
{
	if(m_AdminManager == NULL)
		return false;

	return m_AdminManager->HasFlag(id,"immunity");
}

```


```
Here we register a new access right, that we can check again later. If we dont want to use one of the predefined access rights.
bool ForgiveTK::RegisterNewAcccessFlag()
{
	if(m_AdminManager == NULL)
		return false;

	return m_AdminManager->RegisterFlag("FakeAccess Class","FakeAccessRight","This is a fake access right");
}

```


Pre defined access rights
-------------------------

These are the rights the admin tools allready support. And you can check for in your plugin: Notice that all access rights are in lower case, and they are strings. The reason they are strings is becuse most admin tools are going to handle admin rights internaly diffrently, so this is the only way to export it properbly.

any - The "any" right may only be supported by [Basic Admin Tool](http://forums.alliedmods.net/showthread.php?t=39356), it basicly checks if the user has any of the rights bellow not including reservedslots  
kick - The access to kick a another player.  
slap - The access to slap another player.  
slay - The access to slay another player.  
ban - The access to ban another player.  
chat - The access to use admin chat and or admin say commads.  
rcon - the access to execute commands the server console.  
map - The access to change maps.  
reservedslots - The access to reservedslots.  
immunity - Immunity from certain actions from other players, like kick.  

How do I add the AdminInterface in my plugin
--------------------------------------------

This is only for those that have a admin plugin, and want their plugin to support the interface Download the [Basic Admin Tool](http://forums.alliedmods.net/showthread.php?t=39356) source code, and look at BATInterface .cpp / .h and add it to your plugin. Remember you cannot change AdminInterface / AdminInterfaceListner class in the header file as the interface must be the same in all the admin plugins.