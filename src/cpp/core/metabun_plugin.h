#ifndef _INCLUDE_METABUN_PLUGIN_H_
#define _INCLUDE_METABUN_PLUGIN_H_

#include <nlohmann/json.hpp>
using njson = nlohmann::json;

#include <ISmmPlugin.h>
#include <string>
#include <unordered_map>
#include <vector>

#include "../network/bridge_client.h"
#include "../network/rcon_client.h"
#include "../events/event_manager.h"
#include "../players/player_stats.h"
#include "../process/process_manager.h"
#include "../menus/menu_handler.h"
#include "../hooks/sdk_hooks.h"
#include "../convars/convar_manager.h"
#include "schema_manager.h"

class IServerTools;

class MetaBunPlugin : public ISmmPlugin {
public:
    MetaBunPlugin();
    ~MetaBunPlugin();

    bool Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late) override;
    bool Unload(char *error, size_t maxlen) override;
    void AllPluginsLoaded() override;

    const char *GetAuthor() override { return "C17H19NO3-SS"; }
    const char *GetName() override { return "MetaBun"; }
    const char *GetDescription() override { return "High-performance TypeScript plugin framework bridge"; }
    const char *GetURL() override { return "https://github.com/C17H19NO3-SS/meta-bun"; }
    const char *GetLicense() override { return "MIT"; }
    const char *GetVersion() override { return "1.0.3"; }
    const char *GetDate() override { return __DATE__; }
    const char *GetLogTag() override { return "METABUN"; }

    void OnGameFrame();
    void OnClientDisconnect(int clientIndex, const std::string& reason);
    void OnPlayerChat(int clientIndex, const std::string& text);
    void OnPlayerSpawn(int clientIndex, int team);
    void OnPlayerDeath(int victimIndex, int attackerIndex, int assisterIndex, bool headshot, const std::string& weapon);
    void OnWeaponChange(int clientIndex, const std::string& weaponName);
    void OnRoundStart(int timelimit, int fraglimit);
    void OnRoundEnd(int winner, int reason);
    void OnBombPlanted(int clientIndex, const std::string& site);
    void OnBombDefused(int clientIndex, const std::string& site);
    void OnBombExploded(int clientIndex, const std::string& site);
    void OnHostageRescued(int clientIndex, int hostageIndex);
    void OnItemPickup(int clientIndex, const std::string& item);
    void OnWeaponFire(int clientIndex, const std::string& weapon);
    void OnMapStart(const std::string& mapName);
    void OnMapEnd();
    void OnClientPostAdminCheck(int clientIndex);
    bool OnClientConnect(int clientIndex, const char *name, const char *steamId, int userId, bool isBot, const char *ip, const char *language);
    int OnTakeDamage(int victim, int attacker, float damage, int damageType, int weaponEntity);
    bool Hook_ClientCommand(int clientIndex, const std::string& command, const std::vector<std::string>& args);

    void HandleIncomingMessage(const std::string& line);
    void Send(const njson& obj);

    void HandleActionSay(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSayToClient(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCommand(const std::unordered_map<std::string, std::string>& p);
    void HandleActionPrint(const std::unordered_map<std::string, std::string>& p);
    void HandleActionKick(const std::unordered_map<std::string, std::string>& p);
    void HandleActionBan(const std::unordered_map<std::string, std::string>& p);
    void HandleActionMenu(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCancelVote(const std::unordered_map<std::string, std::string>& p);
    void HandleActionHookEvent(const std::unordered_map<std::string, std::string>& p);
    void HandleActionUnhookEvent(const std::unordered_map<std::string, std::string>& p);
    void HandleActionHookSDK(const std::unordered_map<std::string, std::string>& p);
    void HandleActionUnhookSDK(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSDKHookDecision(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCvarRegister(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCvarSet(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCvarGet(const std::unordered_map<std::string, std::string>& p);
    void HandleActionClientCommand(const std::unordered_map<std::string, std::string>& p);
    void HandleActionClanTag(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetVelocity(const std::unordered_map<std::string, std::string>& p);
    void HandleActionForcedObserver(const std::unordered_map<std::string, std::string>& p);
    void HandleActionPong(const std::unordered_map<std::string, std::string>& p);
    void HandleActionRegisterCommand(const std::unordered_map<std::string, std::string>& p);
    void HandleActionUnregisterCommand(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSlap(const std::unordered_map<std::string, std::string>& p);
    void HandleActionTeleport(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetTeam(const std::unordered_map<std::string, std::string>& p);
    void HandleActionRespawn(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetGravity(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetMoveType(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetHealth(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetModel(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetRenderColor(const std::unordered_map<std::string, std::string>& p);
    void HandleActionPlaySound(const std::unordered_map<std::string, std::string>& p);
    void HandleActionHint(const std::unordered_map<std::string, std::string>& p);
    void HandleActionGiveItem(const std::unordered_map<std::string, std::string>& p);
    void HandleActionRemoveItem(const std::unordered_map<std::string, std::string>& p);
    void HandleActionSetAmmo(const std::unordered_map<std::string, std::string>& p);
    void HandleActionUnban(const std::unordered_map<std::string, std::string>& p);
    void HandleActionScreenFade(const std::unordered_map<std::string, std::string>& p);
    void HandleActionScreenShake(const std::unordered_map<std::string, std::string>& p);
    void HandleActionCreateEntity(const std::unordered_map<std::string, std::string>& p);

    void OnBridgeReconnect();

#ifdef COMPILE_WITH_SOURCE_SDK
    static void OnCustomConsoleCommand(const CCommandContext &context, const CCommand &command);
#endif

    // For sm_test rate limiting
    float m_flLastTestCommandTime = 0.0f;
    void Command_Test(int clientIndex, const char* args);

private:
    BridgeClient          m_Bridge;
    RconClient            m_Rcon;
    EventManager          m_EventManager;
    SDKHooks              m_SdkHooks;
    PlayerStatsCollector  m_PlayerStats;
    ProcessManager        m_ProcessManager;
    MenuHandler           m_MenuHandler;
    ConVarManager         m_CvarManager;

    IVEngineServer*       m_pEngineServer;
    IServerTools*         m_pServerTools;
    IPlayerInfoManager*   m_pPlayerInfoManager;

#ifdef COMPILE_WITH_SOURCE_SDK
    std::unordered_map<std::string, ConCommand*> m_ConCommands;
#endif
};

extern MetaBunPlugin g_MetaBunPlugin;

#endif // _INCLUDE_METABUN_PLUGIN_H_
