#ifndef _INCLUDE_METABUN_BRIDGE_PLUGIN_H_
#define _INCLUDE_METABUN_BRIDGE_PLUGIN_H_

#include <ISmmPlugin.h>

class MetaBunBridge : public ISmmPlugin
{
public:
	bool Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late);
	bool Unload(char *error, size_t maxlen);
	bool Pause(char *error, size_t maxlen);
	bool Unpause(char *error, size_t maxlen);
	void AllPluginsLoaded();
public:
	const char *GetAuthor();
	const char *GetName();
	const char *GetDescription();
	const char *GetURL();
	const char *GetLicense();
	const char *GetVersion();
	const char *GetDate();
	const char *GetLogTag();
};

extern MetaBunBridge g_MetaBunBridge;

PLUGIN_GLOBALVARS();

#endif //_INCLUDE_METABUN_BRIDGE_PLUGIN_H_
