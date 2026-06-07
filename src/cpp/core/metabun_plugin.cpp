#include "metabun_plugin.h"
#include "../utils/json_helper.h"
#include "../utils/color_utils.h"
#include <iostream>
#include <cstdlib>
#include <sstream>
#include <string>
#include <unordered_map>
#include <filesystem>

namespace fs = std::filesystem;


// ─── Global Plugin Instance ──────────────────────────────────────────────────

MetaBunPlugin g_MetaBunPlugin;
ISmmAPI *g_SMAPI = nullptr;

#ifdef COMPILE_WITH_SOURCE_SDK
ICvar *g_pCVar = nullptr;
ISmmPlugin *g_PLAPI = nullptr;
PluginId g_PLID = 0;
#endif

#ifdef _WIN32
    #define METAMOD_EXPORT extern "C" __declspec(dllexport)
#else
    #define METAMOD_EXPORT extern "C" __attribute__((visibility("default")))
#endif

METAMOD_EXPORT void* CreateInterface(const char *name, int *code) {
    if (code) {
        *code = 0; // IFACE_OK
    }
    if (name && std::string(name) == "ISmmPlugin") {
        return static_cast<void *>(&g_MetaBunPlugin);
    }
    return nullptr;
}

METAMOD_EXPORT ISmmPlugin* GetSmmAPI() {
    return &g_MetaBunPlugin;
}

// ─── Ctor / Dtor ─────────────────────────────────────────────────────────────

MetaBunPlugin::MetaBunPlugin()
    : m_pEngineServer(nullptr), m_pPlayerInfoManager(nullptr) {}

MetaBunPlugin::~MetaBunPlugin() {
#ifdef COMPILE_WITH_SOURCE_SDK
    for (auto& pair : m_ConCommands) {
        if (g_SMAPI && g_PLAPI) {
            g_SMAPI->UnregisterConCommand(g_PLAPI, pair.second);
        }
        delete pair.second;
    }
    m_ConCommands.clear();
#endif
}

// ─── Load ─────────────────────────────────────────────────────────────────────

bool MetaBunPlugin::Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late) {
    (void)error;
    (void)maxlen;
    (void)late;

    g_SMAPI = ismm;
#ifdef COMPILE_WITH_SOURCE_SDK
    g_PLAPI = static_cast<ISmmPlugin *>(this);
    g_PLID = id;
#endif
    std::cout << "[MetaBun Plugin] Loading..." << std::endl;

#ifdef COMPILE_WITH_SOURCE_SDK
    GET_V_IFACE_CURRENT(GetEngineFactory, m_pEngineServer, IVEngineServer, INTERFACEVERSION_VENGINESERVER);
    // PlayerInfoManager is not supported or exposed by the CS2 game server and is unused in our codebase.
    // GET_V_IFACE_CURRENT(GetServerFactory, m_pPlayerInfoManager, IPlayerInfoManager, INTERFACEVERSION_PLAYERINFOMANAGER);
    GET_V_IFACE_CURRENT(GetEngineFactory, g_pCVar, ICvar, CVAR_INTERFACE_VERSION);

    // Register commands/convars with both Metamod and the engine
    META_CONVAR_REGISTER(0);
#endif

    // ── Çevre değişkenlerini oku ──────────────────────────────────────────────
    const char* bridgeHostEnv   = std::getenv("BRIDGE_HOST");
    const char* bridgePortEnv   = std::getenv("BRIDGE_PORT");
    const char* bridgeTokenEnv  = std::getenv("BRIDGE_TOKEN");
    const char* protocolEnv     = std::getenv("BRIDGE_PROTOCOL");
    const char* bunBinaryEnv    = std::getenv("BUN_BINARY");
    const char* metaBunDirEnv   = std::getenv("META_BUN_DIR");
    const char* autoSpawnEnv    = std::getenv("META_BUN_AUTO_SPAWN");
    const char* rconPassEnv     = std::getenv("RCON_PASSWORD");

    std::string host       = bridgeHostEnv  ? bridgeHostEnv  : "127.0.0.1";
    int         port       = bridgePortEnv  ? std::atoi(bridgePortEnv) : 27013;
    std::string token      = bridgeTokenEnv ? bridgeTokenEnv : "";
    std::string protocol   = protocolEnv    ? protocolEnv    : "ndjson";
    std::string bunBinary  = bunBinaryEnv   ? bunBinaryEnv   : "bun";
    std::string metaBunDir = metaBunDirEnv ? metaBunDirEnv : "";
    if (metaBunDir.empty()) {
        if (fs::exists("addons/meta-bun")) {
            metaBunDir = "addons/meta-bun";
        } else {
            metaBunDir = ".";
        }
    }
    bool        autoSpawn  = autoSpawnEnv   ? (std::string(autoSpawnEnv) != "0") : true;
    std::string rconPass   = rconPassEnv    ? rconPassEnv    : "meta-bun-rcon";

    // ── 1. Bun process'ini başlat ─────────────────────────────────────────────
    if (autoSpawn) {
        std::cout << "[MetaBun Plugin] Spawning Bun from: " << metaBunDir << std::endl;
        bool spawned = m_ProcessManager.Start(
            metaBunDir, bunBinary, {},
            [](bool running, int exitCode) {
                if (!running) {
                    std::cerr << "[MetaBun] Bun exited (code=" << exitCode << ")" << std::endl;
                } else {
                    std::cout << "[MetaBun] Bun restarted." << std::endl;
                }
            }
        );
        if (!spawned) {
            std::cerr << "[MetaBun Plugin] Could not spawn Bun. Continuing anyway." << std::endl;
        }
    }

    // ── 2. Alt sistemleri başlat ──────────────────────────────────────────────
    m_SdkHooks.Initialize(&m_Bridge);
    m_EventManager.Initialize(&m_Bridge, nullptr);
    m_MenuHandler.Initialize(&m_Bridge, m_pEngineServer);
#ifdef COMPILE_WITH_SOURCE_SDK
    m_CvarManager.Initialize(g_pCVar, nullptr);
#else
    m_CvarManager.Initialize(nullptr, nullptr);
#endif
    m_CvarManager.SetBridge(&m_Bridge);

    m_PlayerStats.Initialize(
        &m_Bridge,
        [this](int clientIndex) -> PlayerStatsCollector::PlayerStats {
            PlayerStatsCollector::PlayerStats stats;
            stats.client = clientIndex;
            // Return fallback stats for both modes since CS2 uses a different entity/schema model.
            stats.health  = 100;
            stats.armor   = 0;
            stats.money   = 3000;
            stats.team    = 2;
            stats.isAlive = true;
            stats.ping    = 0;
            return stats;
        },
        64, 8
    );

    // ── 3. Bridge protokolü ve reconnect callback'i ───────────────────────────
    m_Bridge.SetProtocol(protocol);
    m_Bridge.SetReconnectCallback(std::bind(&MetaBunPlugin::OnBridgeReconnect, this));
    m_Bridge.RegisterCallback(
        std::bind(&MetaBunPlugin::HandleIncomingMessage, this, std::placeholders::_1)
    );
    m_Bridge.Start(host, port, token);

    // ── 4. RCON client (BRIDGE_PORT + 10) ────────────────────────────────────
    m_Rcon.SetResponseCallback([](const std::string& resp) {
        std::cout << "[MetaBun RCON] " << resp;
    });
    if (m_Rcon.Connect(host, port + 10, rconPass)) {
        std::cout << "[MetaBun Plugin] RCON connected on port " << (port + 10) << std::endl;
    } else {
        std::cout << "[MetaBun Plugin] RCON not available yet (Bun may still be starting)." << std::endl;
    }

    std::cout << "[MetaBun Plugin] Loaded. Bridge=" << host << ":" << port
              << " Protocol=" << protocol << std::endl;
    return true;
}

// ─── Unload ───────────────────────────────────────────────────────────────────

bool MetaBunPlugin::Unload(char *error, size_t maxlen) {
    (void)error;
    (void)maxlen;

    std::cout << "[MetaBun Plugin] Unloading..." << std::endl;
    m_EventManager.UnhookAll();
    m_MenuHandler.CloseAllMenus();
    m_Rcon.Disconnect();
    m_Bridge.Stop();
    m_ProcessManager.Stop();
    std::cout << "[MetaBun Plugin] Unloaded." << std::endl;
    return true;
}

// ─── Reconnect Callback ───────────────────────────────────────────────────────

void MetaBunPlugin::OnBridgeReconnect() {
    std::cout << "[MetaBun Plugin] Bridge reconnected — re-registering hooks." << std::endl;

    // Bun'a aktif event hook'larını yeniden bildir
    const auto& hookedEvents = m_EventManager.GetHookedEvents();
    for (const auto& ev : hookedEvents) {
        std::ostringstream ss;
        ss << "{\"action\":\"hook_event\",\"event\":\""
           << json::EscapeString(ev) << "\"}\n";
        m_Bridge.Send(ss.str());
    }

    std::cout << "[MetaBun Plugin] Re-registered " << hookedEvents.size()
              << " event hook(s)." << std::endl;
}

// ─── Incoming Message Dispatcher ─────────────────────────────────────────────

void MetaBunPlugin::HandleIncomingMessage(const std::string& message) {
    auto payload = json::ParseFlatJSON(message);
    auto actionIt = payload.find("action");
    if (actionIt == payload.end()) {
        return;
    }

    const std::string& action = actionIt->second;

    if      (action == "say")                HandleActionSay(payload);
    else if (action == "say_to_client")      HandleActionSayToClient(payload);
    else if (action == "command")            HandleActionCommand(payload);
    else if (action == "print")              HandleActionPrint(payload);
    else if (action == "kick")               HandleActionKick(payload);
    else if (action == "ban")                HandleActionBan(payload);
    else if (action == "menu")               HandleActionMenu(payload);
    else if (action == "cancelvote"
          || action == "sm_cancelvote_engine")
                                             HandleActionCancelVote(payload);
    else if (action == "hook_event")         HandleActionHookEvent(payload);
    else if (action == "unhook_event")       HandleActionUnhookEvent(payload);
    else if (action == "hook_sdk")           HandleActionHookSDK(payload);
    else if (action == "unhook_sdk")         HandleActionUnhookSDK(payload);
    else if (action == "sdk_hook_decision")  HandleActionSDKHookDecision(payload);
    else if (action == "cvar_register")      HandleActionCvarRegister(payload);
    else if (action == "cvar_set")           HandleActionCvarSet(payload);
    else if (action == "cvar_get")           HandleActionCvarGet(payload);
    else if (action == "client_command")     HandleActionClientCommand(payload);
    else if (action == "register_command")   HandleActionRegisterCommand(payload);
    else if (action == "unregister_command") HandleActionUnregisterCommand(payload);
    else if (action == "clan_tag")           HandleActionClanTag(payload);
    else if (action == "set_velocity")       HandleActionSetVelocity(payload);
    else if (action == "forced_observer")    HandleActionForcedObserver(payload);
    else if (action == "pong")               HandleActionPong(payload);
    else if (action == "slap")               HandleActionSlap(payload);
    else if (action == "teleport")           HandleActionTeleport(payload);
    else if (action == "set_team")           HandleActionSetTeam(payload);
    else if (action == "respawn")            HandleActionRespawn(payload);
    else if (action == "set_gravity")        HandleActionSetGravity(payload);
    else if (action == "set_movetype")       HandleActionSetMoveType(payload);
    else if (action == "set_health")         HandleActionSetHealth(payload);
    else if (action == "set_model")          HandleActionSetModel(payload);
    else if (action == "set_render_color")   HandleActionSetRenderColor(payload);
    else if (action == "play_sound")         HandleActionPlaySound(payload);
    else if (action == "hint")               HandleActionHint(payload);
    else if (action == "give_item")          HandleActionGiveItem(payload);
    else if (action == "remove_item")        HandleActionRemoveItem(payload);
    else if (action == "set_ammo")           HandleActionSetAmmo(payload);
    else if (action == "unban")              HandleActionUnban(payload);
    else {
        std::cerr << "[MetaBun Plugin] Unknown action: " << action << std::endl;
    }
}

// ─── Game Event Forwarders ────────────────────────────────────────────────────

void MetaBunPlugin::OnGameFrame() {
    m_SdkHooks.OnGameFrame();
    float curtime = 0.0f;
#ifdef COMPILE_WITH_SOURCE_SDK
    if (g_SMAPI) {
        // curtime = g_SMAPI->GetEngineGlobals()->curtime; // Standard Metamod way
    }
#endif
    m_PlayerStats.OnGameFrame(curtime);
}

bool MetaBunPlugin::OnClientConnect(int clientIndex,
                                    const std::string& name,
                                    const std::string& steamId,
                                    int userId,
                                    bool isBot,
                                    const std::string& ip,
                                    const std::string& language) {
    m_PlayerStats.TrackPlayer(clientIndex);
    return m_SdkHooks.OnClientConnect(clientIndex, name, steamId, userId, isBot, ip, language);
}

void MetaBunPlugin::OnClientDisconnect(int clientIndex, const std::string& reason) {
    m_PlayerStats.UntrackPlayer(clientIndex);
    m_MenuHandler.CloseMenu(clientIndex);
    m_SdkHooks.OnClientDisconnect(clientIndex, reason);
}

void MetaBunPlugin::OnClientPostAdminCheck(int clientIndex) {
    m_SdkHooks.OnClientPostAdminCheck(clientIndex);
}

void MetaBunPlugin::OnPlayerChat(int clientIndex, const std::string& text) {
    if (m_MenuHandler.HasActiveMenu(clientIndex)) {
        const auto* menu = m_MenuHandler.GetActiveMenu(clientIndex);
        if (menu) {
            try {
                std::string cleanText = text;
                // Trim spaces
                cleanText.erase(0, cleanText.find_first_not_of(" \t\r\n"));
                cleanText.erase(cleanText.find_last_not_of(" \t\r\n") + 1);

                // Handle optional prefix
                if (!cleanText.empty() && (cleanText[0] == '!' || cleanText[0] == '/' || cleanText[0] == '.')) {
                    cleanText = cleanText.substr(1);
                }

                int val = std::stoi(cleanText);
                if (val == 0) {
                    m_MenuHandler.OnMenuSelect(clientIndex, -1);
                    return; // Intercepted, do not forward to chat
                } else if (val >= 1 && static_cast<size_t>(val) <= menu->items.size()) {
                    m_MenuHandler.OnMenuSelect(clientIndex, val - 1);
                    return; // Intercepted, do not forward to chat
                }
            } catch (...) {
                std::cerr << "[MetaBun Plugin] Warning: Non-numeric input in menu chat handler." << std::endl;
                // Not a number, let it pass as normal chat
            }
        }
    }
    m_SdkHooks.OnPlayerChat(clientIndex, text);
}

bool MetaBunPlugin::Hook_ClientCommand(int clientIndex, const std::string& command, const std::vector<std::string>& args) {
    // 1. Menu Selection via Console (m <num> or ms <num>)
    if (command == "m" || command == "ms" || command == "meta_select") {
        if (!m_MenuHandler.HasActiveMenu(clientIndex)) {
            if (clientIndex == 0) std::cout << "[MetaBun] You don't have an active console menu." << std::endl;
            else m_pEngineServer->ClientCommand(clientIndex - 1, "echo \"[MetaBun] You don't have an active menu.\"\n");
            return true;
        }

        if (args.empty()) {
            const auto* menu = m_MenuHandler.GetActiveMenu(clientIndex);
            if (menu) {
                m_MenuHandler.ShowMenuExtended(clientIndex, menu->id, menu->title, menu->subTitle, menu->footer, menu->type, menu->items);
            }
            return true;
        }

        try {
            int val = std::stoi(args[0]);
            if (val == 0) m_MenuHandler.OnMenuSelect(clientIndex, -1);
            else m_MenuHandler.OnMenuSelect(clientIndex, val - 1);
            
            if (clientIndex == 0) std::cout << "[MetaBun] Console selection processed." << std::endl;
        } catch (...) {
            if (clientIndex == 0) std::cout << "[MetaBun] Invalid selection. Use: m <number>" << std::endl;
            else m_pEngineServer->ClientCommand(clientIndex - 1, "echo \"[MetaBun] Invalid selection. Use: m <number>\"\n");
        }
        return true;
    }

    // 2. Chat Commands (say, say_team)
    if (command == "say" || command == "say_team") {
        if (!args.empty()) {
            std::string text = args[0];
            OnPlayerChat(clientIndex, text);
            // OnPlayerChat şu an void, ancak ilerde bloklama kararı (bool) dönebilir.
            // Şimdilik Bun tarafındaki PlayerChat interception'ı tetiklemek için yeterli.
        }
    }

    // 3. Weapon Slot Keys (slotX) - Sadece oyuncular için
    if (clientIndex > 0 && m_MenuHandler.HasActiveMenu(clientIndex)) {
        if (command.size() >= 5 && command.substr(0, 4) == "slot") {
            try {
                int slotNum = std::stoi(command.substr(4));
                // slot10 (0 key) her zaman Exit kalsın
                if (slotNum == 10 || slotNum == 0) {
                    m_MenuHandler.OnMenuSelect(clientIndex, -1); 
                } 
                // Bizim yeni düzenimiz: 9 da Exit
                else if (slotNum == 9) {
                    m_MenuHandler.OnMenuSelect(clientIndex, 8); // Index 8 = slot 9
                }
                else {
                    m_MenuHandler.OnMenuSelect(clientIndex, slotNum - 1);
                }
                return true;
            } catch (...) {
                std::cerr << "[MetaBun Plugin] Caught exception in Hook_ClientCommand." << std::endl;
            }
        }
    }
    
    return false;
}

void MetaBunPlugin::OnPlayerSpawn(int clientIndex, int team) {
    m_SdkHooks.OnPlayerSpawn(clientIndex, team);
}

void MetaBunPlugin::OnPlayerDeath(int victimIndex, int attackerIndex,
                                  int assisterIndex, bool headshot,
                                  const std::string& weapon) {
    m_SdkHooks.OnPlayerDeath(victimIndex, attackerIndex, assisterIndex, headshot, weapon);
}

void MetaBunPlugin::OnWeaponChange(int clientIndex, const std::string& weapon) {
    m_SdkHooks.OnWeaponChange(clientIndex, weapon);
}

int MetaBunPlugin::OnTakeDamage(int victim, int attacker, float damage,
                                int damageType, int weaponEntity) {
    return m_SdkHooks.OnTakeDamage(victim, attacker, damage, damageType, weaponEntity);
}

void MetaBunPlugin::OnRoundStart(int timelimit, int fraglimit) {
    if (!m_EventManager.IsHooked("RoundStart") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"RoundStart\",\"timelimit\":" << timelimit
       << ",\"fraglimit\":" << fraglimit << "}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnRoundEnd(int winner, int reason) {
    if (!m_EventManager.IsHooked("RoundEnd") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"RoundEnd\",\"winner\":" << winner
       << ",\"reason\":" << reason << "}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnBombPlanted(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombPlanted") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"BombPlanted\",\"client\":" << clientIndex
       << ",\"site\":\"" << json::EscapeString(site) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnBombDefused(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombDefused") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"BombDefused\",\"client\":" << clientIndex
       << ",\"site\":\"" << json::EscapeString(site) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnBombExploded(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombExploded") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"BombExploded\",\"client\":" << clientIndex
       << ",\"site\":\"" << json::EscapeString(site) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnHostageRescued(int clientIndex, int hostageIndex) {
    if (!m_EventManager.IsHooked("HostageRescued") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"HostageRescued\",\"client\":" << clientIndex
       << ",\"hostage\":" << hostageIndex << "}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnItemPickup(int clientIndex, const std::string& item) {
    if (!m_EventManager.IsHooked("ItemPickup") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"ItemPickup\",\"client\":" << clientIndex
       << ",\"item\":\"" << json::EscapeString(item) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnWeaponFire(int clientIndex, const std::string& weapon) {
    if (!m_EventManager.IsHooked("WeaponFire") || !m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"WeaponFire\",\"client\":" << clientIndex
       << ",\"weapon\":\"" << json::EscapeString(weapon) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnMapStart(const std::string& mapName) {
    if (!m_Bridge.IsConnected()) return;
    std::ostringstream ss;
    ss << "{\"event\":\"MapStart\",\"mapName\":\""
       << json::EscapeString(mapName) << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::OnMapEnd() {
    if (!m_Bridge.IsConnected()) return;
    m_Bridge.Send("{\"event\":\"MapEnd\"}\n");
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

void MetaBunPlugin::HandleActionSay(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("text");
    if (it != p.end() && m_pEngineServer) {
        std::string formatted = ColorUtils::FormatColors(it->second);
        // CS2'de mesajın başındaki renk kodunun çalışması için bazen bir boşluk gerekir.
        // Ayrıca tırnak işaretleri içine alarak özel karakterlerin korunmasını sağlarız.
        std::string cmd = "say \"" + formatted + "\"\n";
        m_pEngineServer->ServerCommand(cmd.c_str());
    }
}

void MetaBunPlugin::HandleActionSayToClient(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("text");
    if (cIt != p.end() && tIt != p.end() && m_pEngineServer) {
        int client = std::atoi(cIt->second.c_str());
        std::string formatted = ColorUtils::FormatColors(tIt->second);
        m_pEngineServer->ClientCommand(client - 1, ("say " + formatted + "\n").c_str());
    }
}

void MetaBunPlugin::HandleActionCommand(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("cmd");
    if (it != p.end() && m_pEngineServer) {
        m_pEngineServer->ServerCommand((it->second + "\n").c_str());
    }
}

void MetaBunPlugin::HandleActionPrint(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("message");
    if (it != p.end()) {
        std::string formatted = ColorUtils::FormatConsole(it->second);
#ifdef COMPILE_WITH_SOURCE_SDK
        META_CONPRINTF("%s\n", formatted.c_str());
#else
        std::cout << formatted << std::endl;
#endif
    }
}

void MetaBunPlugin::HandleActionKick(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto rIt = p.find("reason");
    if (cIt == p.end() || !m_pEngineServer) return;

    int client = std::atoi(cIt->second.c_str());
    std::string reason = (rIt != p.end()) ? rIt->second : "Kicked by admin";

    std::ostringstream cmd;
    cmd << "kickid " << client << " \"" << reason << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
}

void MetaBunPlugin::HandleActionBan(
        const std::unordered_map<std::string, std::string>& p) {
    auto sIt = p.find("steamid");
    auto dIt = p.find("duration");
    auto rIt = p.find("reason");
    if (sIt == p.end() || !m_pEngineServer) return;

    std::string duration = (dIt != p.end()) ? dIt->second : "0";
    std::string reason   = (rIt != p.end()) ? rIt->second : "Banned";

    std::ostringstream cmd;
    cmd << "banid " << duration << " " << sIt->second << " kick\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
}

void MetaBunPlugin::HandleActionMenu(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt     = p.find("client");
    auto idIt    = p.find("menu_id");
    auto titleIt = p.find("menu_title");
    auto subIt   = p.find("menu_subtitle");
    auto footIt  = p.find("menu_footer");
    auto typeIt  = p.find("menu_type");
    auto itemsIt = p.find("menu_items_json");

    if (cIt == p.end() || idIt == p.end()) return;

    int client       = std::atoi(cIt->second.c_str());
    std::string id    = idIt->second;
    std::string title = (titleIt != p.end()) ? titleIt->second : "Menu";
    std::string sub   = (subIt != p.end()) ? subIt->second : "";
    std::string foot  = (footIt != p.end()) ? footIt->second : "";
    int type          = (typeIt != p.end()) ? std::atoi(typeIt->second.c_str()) : 0;

    std::vector<MenuHandler::MenuItem> items;
    if (itemsIt != p.end()) {
        auto parsed = json::ParseMenuItemsJSON(itemsIt->second);
        for (const auto& mi : parsed) {
            MenuHandler::MenuItem item;
            item.display = mi.display;
            item.info    = mi.info;
            items.push_back(item);
        }
    }

    m_MenuHandler.ShowMenuExtended(client, id, title, sub, foot, type, items);
}

void MetaBunPlugin::HandleActionCancelVote(
        const std::unordered_map<std::string, std::string>& p) {
    (void)p;
    if (m_pEngineServer) {
        m_pEngineServer->ServerCommand("sm_cancelvote\n");
    }
    m_MenuHandler.CloseAllMenus();
}

void MetaBunPlugin::HandleActionHookEvent(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("event");
    if (it != p.end()) {
        m_EventManager.HookEvent(it->second);
    }
}

void MetaBunPlugin::HandleActionUnhookEvent(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("event");
    if (it != p.end()) {
        m_EventManager.UnhookEvent(it->second);
    }
}

void MetaBunPlugin::HandleActionHookSDK(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("type");
    if (cIt != p.end() && tIt != p.end()) {
        m_SdkHooks.HookSDK(std::atoi(cIt->second.c_str()),
                           std::atoi(tIt->second.c_str()));
    }
}

void MetaBunPlugin::HandleActionUnhookSDK(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("type");
    if (cIt != p.end() && tIt != p.end()) {
        m_SdkHooks.UnhookSDK(std::atoi(cIt->second.c_str()),
                             std::atoi(tIt->second.c_str()));
    }
}

void MetaBunPlugin::HandleActionSDKHookDecision(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt    = p.find("client");
    auto tIt    = p.find("type");
    auto decIt  = p.find("decision");
    if (cIt != p.end() && tIt != p.end() && decIt != p.end()) {
        m_SdkHooks.SetSDKHookDecision(
            std::atoi(cIt->second.c_str()),
            std::atoi(tIt->second.c_str()),
            std::atoi(decIt->second.c_str())
        );
    }
}

void MetaBunPlugin::HandleActionCvarRegister(
        const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto dIt = p.find("defaultValue");
    auto dsIt = p.find("description");
    if (nIt == p.end() || dIt == p.end()) return;
    std::string desc = (dsIt != p.end()) ? dsIt->second : "";
    m_CvarManager.RegisterConVar(nIt->second, dIt->second, desc);
}

void MetaBunPlugin::HandleActionCvarSet(
        const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto vIt = p.find("value");
    if (nIt != p.end() && vIt != p.end()) {
        m_CvarManager.SetConVar(nIt->second, vIt->second);
    }
}

void MetaBunPlugin::HandleActionCvarGet(
        const std::unordered_map<std::string, std::string>& p) {
    auto nIt   = p.find("name");
    auto reqIt = p.find("requestId");
    if (nIt == p.end() || !m_Bridge.IsConnected()) return;

    std::string value = m_CvarManager.GetConVar(nIt->second);
    std::string reqId = (reqIt != p.end()) ? reqIt->second : "";

    std::ostringstream ss;
    ss << "{\"event\":\"ConVarValue\","
       << "\"name\":\""       << json::EscapeString(nIt->second) << "\","
       << "\"value\":\""      << json::EscapeString(value)        << "\","
       << "\"requestId\":\"" << json::EscapeString(reqId)         << "\"}\n";
    m_Bridge.Send(ss.str());
}

void MetaBunPlugin::HandleActionClientCommand(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto cmdIt = p.find("cmd");
    if (cIt == p.end() || cmdIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    m_pEngineServer->ClientCommand(client - 1, (cmdIt->second + "\n").c_str());
}

void MetaBunPlugin::HandleActionClanTag(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("tag");
    if (cIt == p.end() || tIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());

    // CS2: CCSPlayerController.m_szClanName prop yazımı gerekir;
    // SDK olmadan ServerCommand fallback kullanılır.
    std::ostringstream cmd;
    cmd << "sm_setclantag " << client << " \"" << tIt->second << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
}

void MetaBunPlugin::HandleActionSetVelocity(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt  = p.find("client");
    auto uxIt = p.find("userid");
    auto xIt  = p.find("x");
    auto yIt  = p.find("y");
    auto zIt  = p.find("z");

    if (cIt == p.end() || !m_pEngineServer) return;

    // userId veya clientIndex ile komut çalıştır
    std::string userId = (uxIt != p.end()) ? uxIt->second : cIt->second;
    std::string x = (xIt != p.end()) ? xIt->second : "0";
    std::string y = (yIt != p.end()) ? yIt->second : "0";
    std::string z = (zIt != p.end()) ? zIt->second : "0";

    // CS2 SDK olmadan: IPlayerInfo veya entity offset ile
    // sm_setvelocity komutu aracılığı (extension gerekebilir).
    // SDK ile: CBaseEntity::SetAbsVelocity(Vector(x, y, z))
    std::ostringstream cmd;
    cmd << "sm_setvelocity " << userId << " " << x << " " << y << " " << z << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());

    std::cout << "[MetaBun Plugin] SetVelocity for client " << cIt->second
              << ": " << x << " " << y << " " << z << std::endl;
}

void MetaBunPlugin::HandleActionForcedObserver(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto fIt = p.find("forced");
    if (cIt == p.end() || !m_pEngineServer) return;

    int client = std::atoi(cIt->second.c_str());
    bool forced = (fIt != p.end()) ? json::ParseBool(fIt->second) : true;

    // CS2 SDK: CCSPlayerController::ForceToSpectate(forced)
    // Fallback: team 1 (spectator) olarak değiştir
    if (forced) {
        std::ostringstream cmd;
        cmd << "sm_team " << client << " 1\n"; // Team 1 = Spectator
        m_pEngineServer->ServerCommand(cmd.str().c_str());
    }

    std::cout << "[MetaBun Plugin] ForcedObserver client=" << client
              << " forced=" << (forced ? "true" : "false") << std::endl;

    // Bun'a durumu geri bildir
    if (m_Bridge.IsConnected()) {
        std::ostringstream ss;
        ss << "{\"event\":\"ForcedObserverSet\","
           << "\"client\":" << client << ","
           << "\"forced\":"  << (forced ? "true" : "false") << "}\n";
        m_Bridge.Send(ss.str());
    }
}

void MetaBunPlugin::HandleActionPong(
        const std::unordered_map<std::string, std::string>& p) {
    auto tsIt = p.find("timestamp_ms");
    if (tsIt != p.end()) {
        long long sentTs = json::ParseTimestampMs(tsIt->second);
        m_Bridge.HandlePong(sentTs);
        double latency = m_Bridge.GetLatencyMs();
        // std::cout << "[MetaBun Plugin] Bridge latency: " << latency << " ms" << std::endl;
        std::stringstream ss;
        ss << "{\"event\":\"BridgeLatencyUpdate\",\"latency\":" << latency << "}\n";
        m_Bridge.Send(ss.str());
    }
}

void MetaBunPlugin::HandleActionRegisterCommand(const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto descIt = p.find("description");
    if (nIt != p.end()) {
        std::string name = nIt->second;
        std::string desc = descIt != p.end() ? descIt->second : "";
#ifdef COMPILE_WITH_SOURCE_SDK
        if (m_ConCommands.find(name) != m_ConCommands.end()) {
            return;
        }
        ConCommand* pCmd = new ConCommand(
            name.c_str(),
            &MetaBunPlugin::OnCustomConsoleCommand,
            desc.c_str(),
            0
        );
        m_ConCommands[name] = pCmd;
#else
        std::cout << "[MetaBun Mock] Registered command: " << name << " (" << desc << ")" << std::endl;
#endif
    }
}

void MetaBunPlugin::HandleActionUnregisterCommand(const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    if (nIt != p.end()) {
        std::string name = nIt->second;
#ifdef COMPILE_WITH_SOURCE_SDK
        auto it = m_ConCommands.find(name);
        if (it != m_ConCommands.end()) {
            if (g_SMAPI && g_PLAPI) {
                g_SMAPI->UnregisterConCommand(g_PLAPI, it->second);
            }
            delete it->second;
            m_ConCommands.erase(it);
        }
#else
        std::cout << "[MetaBun Mock] Unregistered command: " << name << std::endl;
#endif
    }
}

#ifdef COMPILE_WITH_SOURCE_SDK
void MetaBunPlugin::OnCustomConsoleCommand(const CCommandContext &context, const CCommand &command) {
    if (!g_MetaBunPlugin.m_Bridge.IsConnected()) return;

    int clientIndex = 0;
    if (context.GetPlayerSlot().IsValid()) {
        clientIndex = context.GetPlayerSlot().Get() + 1;
    }

    std::ostringstream ss;
    ss << "{\"event\":\"ConsoleCommand\",\"client\":" << clientIndex
       << ",\"command\":\"" << json::EscapeString(command.Arg(0)) << "\",\"args\":[";

    for (int i = 1; i < command.ArgC(); ++i) {
        if (i > 1) ss << ",";
        ss << "\"" << json::EscapeString(command.Arg(i)) << "\"";
    }
    ss << "]}\n";

    g_MetaBunPlugin.m_Bridge.Send(ss.str());
}
#endif

void MetaBunPlugin::HandleActionSlap(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto dIt = p.find("damage");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int damage = (dIt != p.end()) ? std::atoi(dIt->second.c_str()) : 0;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerPawn.m_iHealth hasarı uygula, ve itme kuvveti için SetAbsVelocity uygula.
    // Metamod native fallback: sunucu komutu aracılığıyla çalıştır
    std::ostringstream cmd;
    cmd << "sm_slap " << client << " " << damage << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Slap client=" << client << " damage=" << damage << std::endl;
#endif
}

void MetaBunPlugin::HandleActionTeleport(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto xIt = p.find("x");
    auto yIt = p.find("y");
    auto zIt = p.find("z");
    if (cIt == p.end() || xIt == p.end() || yIt == p.end() || zIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    float x = std::stof(xIt->second);
    float y = std::stof(yIt->second);
    float z = std::stof(zIt->second);

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CBaseEntity::Teleport(&Vector(x, y, z), nullptr, nullptr)
    std::ostringstream cmd;
    cmd << "sm_teleport " << client << " " << x << " " << y << " " << z << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Teleport client=" << client << " to (" << x << ", " << y << ", " << z << ")" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetTeam(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("team");
    if (cIt == p.end() || tIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int team = std::atoi(tIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerController::SwitchTeam(team)
    std::ostringstream cmd;
    cmd << "sm_team " << client << " " << team << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetTeam client=" << client << " team=" << team << std::endl;
#endif
}

void MetaBunPlugin::HandleActionRespawn(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerController::Respawn()
    std::ostringstream cmd;
    cmd << "sm_respawn " << client << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Respawn client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetGravity(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto gIt = p.find("gravity");
    if (cIt == p.end() || gIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    float gravity = std::stof(gIt->second);

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CBaseEntity.m_flGravity = gravity
    std::ostringstream cmd;
    cmd << "sm_gravity " << client << " " << gravity << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetGravity client=" << client << " gravity=" << gravity << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetMoveType(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto mIt = p.find("movetype");
    if (cIt == p.end() || mIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int movetype = std::atoi(mIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CBaseEntity.m_MoveType = movetype
    std::ostringstream cmd;
    cmd << "sm_movetype " << client << " " << movetype << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetMoveType client=" << client << " movetype=" << movetype << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetHealth(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto hIt = p.find("health");
    if (cIt == p.end() || hIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int health = std::atoi(hIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerPawn.m_iHealth = health
    std::ostringstream cmd;
    cmd << "sm_health " << client << " " << health << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetHealth client=" << client << " health=" << health << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetModel(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto mIt = p.find("model");
    if (cIt == p.end() || mIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    std::string model = mIt->second;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CBaseEntity::SetModel(model.c_str())
    std::ostringstream cmd;
    cmd << "sm_model " << client << " " << model << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetModel client=" << client << " model=" << model << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetRenderColor(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto rIt = p.find("r");
    auto gIt = p.find("g");
    auto bIt = p.find("b");
    auto aIt = p.find("a");
    if (cIt == p.end() || rIt == p.end() || gIt == p.end() || bIt == p.end() || aIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int r = std::atoi(rIt->second.c_str());
    int g = std::atoi(gIt->second.c_str());
    int b = std::atoi(bIt->second.c_str());
    int a = std::atoi(aIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CBaseEntity.m_clrRender = Color(r,g,b,a)
    std::ostringstream cmd;
    cmd << "sm_rendercolor " << client << " " << r << " " << g << " " << b << " " << a << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetRenderColor client=" << client << " color=(" << r << "," << g << "," << b << "," << a << ")" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionPlaySound(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto sIt = p.find("sound");
    auto vIt = p.find("volume");
    auto chIt = p.find("channel");
    auto pIt = p.find("pitch");
    auto aIt = p.find("all");
    if (sIt == p.end() || !m_pEngineServer) return;

    std::string sound = sIt->second;
    float volume = (vIt != p.end()) ? std::stof(vIt->second) : 1.0f;
    int channel = (chIt != p.end()) ? std::atoi(chIt->second.c_str()) : 0;
    int pitch = (pIt != p.end()) ? std::atoi(pIt->second.c_str()) : 100;
    bool all = (aIt != p.end()) ? json::ParseBool(aIt->second) : false;
    int client = (cIt != p.end()) ? std::atoi(cIt->second.c_str()) : 0;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: enginesound->EmitSound(...)
    std::ostringstream cmd;
    if (all) {
        cmd << "sm_playsoundall " << sound << " " << volume << " " << channel << " " << pitch << "\n";
    } else {
        cmd << "sm_playsound " << client << " " << sound << " " << volume << " " << channel << " " << pitch << "\n";
    }
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] PlaySound sound=" << sound << " all=" << (all ? "true" : "false") << " client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionGiveItem(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto iIt = p.find("item");
    if (cIt == p.end() || iIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    std::string item = iIt->second;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerPawn::GiveNamedItem(item)
    std::ostringstream cmd;
    cmd << "sm_give " << client << " " << item << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] GiveItem client=" << client << " item=" << item << std::endl;
#endif
}

void MetaBunPlugin::HandleActionRemoveItem(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto iIt = p.find("item");
    if (cIt == p.end() || iIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    std::string item = iIt->second;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSPlayerPawn::RemoveNamedItem(item)
    std::ostringstream cmd;
    cmd << "sm_removeitem " << client << " " << item << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] RemoveItem client=" << client << " item=" << item << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetAmmo(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto wIt = p.find("weapon");
    auto aIt = p.find("ammo");
    if (cIt == p.end() || wIt == p.end() || aIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    std::string weapon = wIt->second;
    int ammo = std::atoi(aIt->second.c_str());

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: CCSWeaponBase::SetReserveAmmo(ammo) / SetClipAmmo(ammo)
    std::ostringstream cmd;
    cmd << "sm_setammo " << client << " " << weapon << " " << ammo << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetAmmo client=" << client << " weapon=" << weapon << " ammo=" << ammo << std::endl;
#endif
}

void MetaBunPlugin::HandleActionUnban(const std::unordered_map<std::string, std::string>& p) {
    auto sIt = p.find("steamid");
    if (sIt == p.end() || !m_pEngineServer) return;

#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "removeid " << sIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Unban steamid=" << sIt->second << std::endl;
#endif
}

void MetaBunPlugin::HandleActionHint(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("text");
    if (cIt == p.end() || tIt == p.end() || !m_pEngineServer) return;

    int client = std::atoi(cIt->second.c_str());
    std::string text = tIt->second;

#ifdef COMPILE_WITH_SOURCE_SDK
    // CS2 SDK: Usermessage HintText
    // Fallback: sm_hint command
    std::ostringstream cmd;
    cmd << "sm_hint " << client << " \"" << text << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Hint client=" << client << " text=\"" << text << "\"" << std::endl;
#endif
}
