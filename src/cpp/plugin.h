#ifndef _INCLUDE_METABUN_BRIDGE_PLUGIN_H_
#define _INCLUDE_METABUN_BRIDGE_PLUGIN_H_

#include <ISmmPlugin.h>
#include <igameevents.h>
#include <vector>
#include <string>
#include <stdint.h>
#include <set>
#include <map>
#include <eiface.h>
#include <icvar.h>
#include <convar.h>
#include <sys/types.h>

struct MetaBunCommand {
	std::string name;
	std::string help;
	bool bSilent;
	ConCommandRef ref;
};

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

	void Log(const char *fmt, ...);
	void StartServer();
	void SpawnBun();
	void StopBun();
	void Disconnect();
	void Send(const uint8_t *data, uint32_t size);
	void SendAction(const char *action, const char *extraKey = nullptr, const char *extraValue = nullptr);
	void UpdateBridge();
	void ProcessMessage(const uint8_t *data, uint32_t size);

	void Hook_DispatchConCommand(ConCommandRef cmd, const CCommandContext &ctx, const CCommand &args);
	void OnDynamicCommand(const CCommandContext &context, const CCommand &args);
	void OnGameFrame(bool simulating, bool bFirstTick, bool bLastTick);

private:
	int m_ListenSocket;
	int m_ClientSocket;
	bool m_Connected;
	pid_t m_BunPid;
	std::vector<uint8_t> m_ReceiveBuffer;

	ISmmAPI *ismm;
	IVEngineServer *engine;
	IServerGameClients *gameclients;
	IServerGameDLL *server;
	ICvar *icvar;

	// Keep track of dynamically registered commands to avoid duplicates
	std::map<std::string, MetaBunCommand*> m_DynamicCommands;
};

extern MetaBunBridge g_MetaBunBridge;

PLUGIN_GLOBALVARS();

SH_DECL_HOOK3_void(ICvar, DispatchConCommand, SH_NOATTRIB, 0, ConCommandRef, const CCommandContext &, const CCommand &);

#endif //_INCLUDE_METABUN_BRIDGE_PLUGIN_H_
