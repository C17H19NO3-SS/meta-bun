#include <stdio.h>
#include "plugin.h"

MetaBunBridge g_MetaBunBridge;
PLUGIN_EXPOSE(MetaBunBridge, g_MetaBunBridge);

bool MetaBunBridge::Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late)
{
	PLUGIN_SAVEVARS();

	return true;
}

bool MetaBunBridge::Unload(char *error, size_t maxlen)
{
	return true;
}

void MetaBunBridge::AllPluginsLoaded()
{
}

bool MetaBunBridge::Pause(char *error, size_t maxlen)
{
	return true;
}

bool MetaBunBridge::Unpause(char *error, size_t maxlen)
{
	return true;	
}

const char *MetaBunBridge::GetAuthor()
{
	return "MetaBun Team";
}

const char *MetaBunBridge::GetName()
{
	return "MetaBun Bridge";
}

const char *MetaBunBridge::GetDescription()
{
	return "TypeScript/Bun bridge for Metamod:Source";
}

const char *MetaBunBridge::GetURL()
{
	return "https://github.com/meta-bun/meta-bun";
}

const char *MetaBunBridge::GetLicense()
{
	return "MIT";
}

const char *MetaBunBridge::GetVersion()
{
	return "1.0.0";
}

const char *MetaBunBridge::GetDate()
{
	return __DATE__;
}

const char *MetaBunBridge::GetLogTag()
{
	return "METABUN";
}
