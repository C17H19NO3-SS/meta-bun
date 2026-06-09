#ifndef _INCLUDE_METABUN_BRIDGE_PLUGIN_H_
#define _INCLUDE_METABUN_BRIDGE_PLUGIN_H_

#include <ISmmPlugin.h>
#include <igameevents.h>
#include <vector>
#include <string>
#include <stdint.h>
#include <thread>
#include <atomic>
#include <eiface.h>

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

	void Connect();
	void Disconnect();
	void Send(const uint8_t *data, uint32_t size);
	void SendAction(const char *action, const char *extraKey = nullptr, const char *extraValue = nullptr);
	void ReceiveThread();
	void ProcessMessage(const uint8_t *data, uint32_t size);

	void Hook_ClientCommand(edict_t *pEntity);
	void Hook_FireGameEvent(IGameEvent *pEvent, bool bDontBroadcast);

private:
	int m_Socket;
	std::atomic<bool> m_Connected;
	std::atomic<bool> m_ShouldExit;
	std::thread m_ReceiveThread;

	IVEngineServer *engine;
	IGameEventManager2 *gameevents;
};

extern MetaBunBridge g_MetaBunBridge;

PLUGIN_GLOBALVARS();

SH_DECL_HOOK1_void(IVEngineServer, ClientCommand, SH_NOATTRIB, 0, edict_t *);
SH_DECL_HOOK2_void(IGameEventManager2, FireGameEvent, SH_NOATTRIB, 0, IGameEvent *, bool);

#endif //_INCLUDE_METABUN_BRIDGE_PLUGIN_H_
