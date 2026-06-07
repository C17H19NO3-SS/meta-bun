#ifndef _INCLUDE_METABUN_PLUGIN_H_
#define _INCLUDE_METABUN_PLUGIN_H_

#include "sdk_mock.h"
#include "../network/bridge_client.h"
#include "../network/rcon_client.h"
#include "../convars/convar_manager.h"
#include "../hooks/sdk_hooks.h"
#include "../events/event_manager.h"
#include "../players/player_stats.h"
#include "../process/process_manager.h"
#include "../menus/menu_handler.h"

/**
 * MetaBunPlugin — Metamod:Source ana plugin sınıfı.
 *
 * Load() sırasında yapılan işlemler (sırasıyla):
 *   1. ProcessManager aracılığıyla Bun runtime sürecini başlatır.
 *   2. BridgeClient ile TCP bağlantısı kurar (protokol: BRIDGE_PROTOCOL env).
 *   3. RconClient ile Bun RCON sunucusuna bağlanır (BRIDGE_PORT+10).
 *   4. Tüm alt sistemleri başlatır.
 *
 * Desteklenen GameAction türleri (Bun → C++):
 *   "say"                — tüm oyunculara chat
 *   "say_to_client"      — tek oyuncuya chat
 *   "command"            — server console komutu
 *   "kick"               — oyuncuyu at
 *   "ban"                — oyuncuyu yasakla
 *   "menu"               — interaktif menü göster
 *   "cancelvote"         — oylamayı iptal et
 *   "hook_event"         — event dinlemeye başla
 *   "unhook_event"       — event dinlemeyi bırak
 *   "hook_sdk"           — SDK hook ekle
 *   "unhook_sdk"         — SDK hook kaldır
 *   "sdk_hook_decision"  — SDKHook blok kararı önbelleği
 *   "cvar_register"      — ConVar kaydet
 *   "cvar_set"           — ConVar değeri yaz
 *   "cvar_get"           — ConVar değeri oku (yanıt gönderir)
 *   "client_command"     — client'e komut gönder
 *   "clan_tag"           — clan tag değiştir
 *   "set_velocity"       — entity hız vektörü ayarla
 *   "forced_observer"    — oyuncuyu gözlemciye zorla/çıkar
 *   "pong"               — ping RTT yanıtı
 */
class IServerTools;

class MetaBunPlugin : public ISmmPlugin {
public:
    MetaBunPlugin();
    ~MetaBunPlugin();

    bool Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late) override;
    bool Unload(char *error, size_t maxlen) override;

    const char *GetAuthor() override { return "Antigravity Team"; }
    const char *GetName() override { return "MetaBun"; }
    const char *GetDescription() override { return "MetaBun Metamod Plugin"; }
    const char *GetURL() override { return "https://github.com/google-deepmind/meta-bun"; }
    const char *GetLicense() override { return "BSD"; }
    const char *GetVersion() override { return "1.0.0"; }
    const char *GetDate() override { return __DATE__; }
    const char *GetLogTag() override { return "METABUN"; }

    /**
     * Bun'dan gelen NDJSON mesajını ayrıştır ve ilgili sisteme yönlendir.
     */
    void HandleIncomingMessage(const std::string& message);

    // ── Oyun motoru tarafından çağrılan hook noktaları ───────────────────────

    void OnGameFrame();

    bool OnClientConnect(int clientIndex,
                         const std::string& name,
                         const std::string& steamId,
                         int userId,
                         bool isBot,
                         const std::string& ip = "",
                         const std::string& language = "en");

    void OnClientDisconnect(int clientIndex, const std::string& reason);
    void OnPlayerChat(int clientIndex, const std::string& text);
    void OnPlayerSpawn(int clientIndex, int team);

    void OnPlayerDeath(int victimIndex, int attackerIndex, int assisterIndex,
                       bool headshot, const std::string& weapon);

    /**
     * Client'dan gelen komutları yakalar. slotX komutlarını menü için intercept eder.
     */
    bool Hook_ClientCommand(int clientIndex, const std::string& command, const std::vector<std::string>& args);

    void OnWeaponChange(int clientIndex, const std::string& weapon);
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

    /**
     * Admin check tamamlandığında çağrılır.
     * SDKHooks::OnClientPostAdminCheck + EventManager::DispatchEvent tetikler.
     */
    void OnClientPostAdminCheck(int clientIndex);

    /**
     * SDKHook OnTakeDamage — C++ motor callback'inden çağrılır.
     * @return 0=geçir, 3=Plugin_Handled, 4=Plugin_Stop
     */
    int OnTakeDamage(int victim, int attacker, float damage,
                     int damageType, int weaponEntity);

#ifdef COMPILE_WITH_SOURCE_SDK
    static void OnCustomConsoleCommand(const CCommandContext &context, const CCommand &command);
#endif

private:
    // ── Action handler'lar ───────────────────────────────────────────────────
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

    /**
     * Yeniden bağlanınca aktif hook'ları Bun'a yeniden bildir.
     * BridgeClient::SetReconnectCallback olarak kaydedilir.
     */
    void OnBridgeReconnect();

    // ── Üye değişkenler ──────────────────────────────────────────────────────
    BridgeClient          m_Bridge;
    RconClient            m_Rcon;
    ConVarManager         m_CvarManager;
    SDKHooks              m_SdkHooks;
    EventManager          m_EventManager;
    PlayerStatsCollector  m_PlayerStats;
    ProcessManager        m_ProcessManager;
    MenuHandler           m_MenuHandler;

    IVEngineServer*       m_pEngineServer;
    IServerTools*         m_pServerTools;
    IPlayerInfoManager*   m_pPlayerInfoManager;

#ifdef COMPILE_WITH_SOURCE_SDK
    std::unordered_map<std::string, ConCommand*> m_ConCommands;
#endif
};

extern MetaBunPlugin g_MetaBunPlugin;

#endif // _INCLUDE_METABUN_PLUGIN_H_
