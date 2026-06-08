#include "metabun_plugin.h"
#include "schema_manager.h"
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
#include "toolframework/itoolentity.h"
#include "schemasystem/schemasystem.h"
ICvar *g_pCVar = nullptr;
ISmmPlugin *g_PLAPI = nullptr;
PluginId g_PLID = 0;
ISchemaSystem* g_pSchemaSystem = nullptr;

void sm_test_callback(const CCommandContext& context, const CCommand& args) {
    (void)args;
    g_MetaBunPlugin.Command_Test(context.GetPlayerSlot().Get() + 1, args.GetCommandString());
}
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
    : m_pEngineServer(nullptr), m_pServerTools(nullptr), m_pPlayerInfoManager(nullptr) {}

MetaBunPlugin::~MetaBunPlugin() {
#ifdef COMPILE_WITH_SOURCE_SDK
    for (auto& pair : m_ConCommands) {
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
    
    // Try multiple versions of ServerTools as Valve often increments these
    m_pServerTools = (IServerTools*)ismm->VInterfaceMatch(ismm->GetServerFactory(), "VSERVERTOOLS003", 0);
    if (!m_pServerTools) m_pServerTools = (IServerTools*)ismm->VInterfaceMatch(ismm->GetServerFactory(), "VSERVERTOOLS002", 0);
    if (!m_pServerTools) m_pServerTools = (IServerTools*)ismm->VInterfaceMatch(ismm->GetServerFactory(), "VSERVERTOOLS001", 0);
    
    if (!m_pServerTools) {
        std::cerr << "[MetaBun] Warning: Could not find IServerTools (tried 001-003). Entity spawning will use fallback commands." << std::endl;
    }

    GET_V_IFACE_ANY(GetEngineFactory, g_pSchemaSystem, ISchemaSystem, SCHEMASYSTEM_INTERFACE_VERSION);
    GET_V_IFACE_CURRENT(GetEngineFactory, g_pCVar, ICvar, CVAR_INTERFACE_VERSION);

    g_SchemaManager.Initialize();

    // Register test command
    static ConCommand sm_test_cmd("sm_test", sm_test_callback, "MetaBun: Dynamic Schema & Offset Test Command", 0);
    g_SMAPI->RegisterConCommand(g_PLAPI, &sm_test_cmd);

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
            return stats;
        },
        64, 8
    );

    // ── 3. Köprü bağlantısını kur ─────────────────────────────────────────────
    m_Bridge.SetProtocol(protocol);
    m_Bridge.RegisterCallback(std::bind(&MetaBunPlugin::HandleIncomingMessage, this, std::placeholders::_1));
    m_Bridge.SetReconnectCallback(std::bind(&MetaBunPlugin::OnBridgeReconnect, this));
    
    m_Bridge.Start(host, port, token);

    // ── 4. RCON bağlantısını kur (isteğe bağlı) ───────────────────────────────
    // if (!rconPass.empty()) m_Rcon.Connect("127.0.0.1", port + 10, rconPass);

    return true;
}

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

void MetaBunPlugin::AllPluginsLoaded() {
    // Optional: add logic here if needed
}

// ─── Reconnect Callback ───────────────────────────────────────────────────────

void MetaBunPlugin::OnBridgeReconnect() {
    std::cout << "[MetaBun Plugin] Bridge reconnected — re-registering hooks." << std::endl;

    // Bun'a aktif event hook'larını yeniden bildir
    const auto& hookedEvents = m_EventManager.GetHookedEvents();
    for (const auto& ev : hookedEvents) {
        njson j;
        j["action"] = "hook_event";
        j["event"] = ev;
        Send(j);
    }

    std::cout << "[MetaBun Plugin] Re-registered " << hookedEvents.size()
              << " event hook(s)." << std::endl;
}

// ─── Incoming Message Dispatcher ─────────────────────────────────────────────

void MetaBunPlugin::Send(const njson& obj) {
    m_Bridge.Send(obj);
}

void MetaBunPlugin::HandleIncomingMessage(const std::string& message) {
    njson j;
    try {
        if (m_Bridge.GetProtocol() == "length_prefixed_msgpack") {
            std::vector<uint8_t> msgpack(message.begin(), message.end());
            j = njson::from_msgpack(msgpack);
        } else {
            j = njson::parse(message);
        }
    } catch (const std::exception& e) {
        std::cerr << "[MetaBun Plugin] Failed to decode incoming message: " << e.what() << std::endl;
        return;
    }

    if (!j.is_object() || !j.contains("action")) return;
    
    std::unordered_map<std::string, std::string> payload;
    for (auto& el : j.items()) {
        if (el.value().is_string()) {
            payload[el.key()] = el.value().get<std::string>();
        } else {
            payload[el.key()] = el.value().dump();
        }
    }

    const std::string& action = payload["action"];

    if      (action == "say")                HandleActionSay(payload);
    else if (action == "say_to_client")      HandleActionSayToClient(payload);
    else if (action == "command")            HandleActionCommand(payload);
    else if (action == "print")              HandleActionPrint(payload);
    else if (action == "kick")               HandleActionKick(payload);
    else if (action == "ban")                HandleActionBan(payload);
    else if (action == "menu")               HandleActionMenu(payload);
    else if (action == "auth_success")       std::cout << "[MetaBun] Authenticated." << std::endl;
    else if (action == "auth_failed")        std::cerr << "[MetaBun] Auth failed!" << std::endl;
    else if (action == "pong")               {
        auto tIt = payload.find("timestamp_ms");
        if (tIt != payload.end()) m_Bridge.HandlePong(std::stoll(tIt->second));
    }
    else if (action == "hook_event") { /* Handled by EventManager */ }
    else if (action == "cvar_register")      HandleActionCvarRegister(payload);
    else if (action == "cvar_set")           HandleActionCvarSet(payload);
    else if (action == "cvar_get")           HandleActionCvarGet(payload);
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
    else if (action == "screen_fade")        HandleActionScreenFade(payload);
    else if (action == "screen_shake")       HandleActionScreenShake(payload);
    else if (action == "create_entity")      HandleActionCreateEntity(payload);
    else {
        std::cerr << "[MetaBun Plugin] Unknown action: " << action << std::endl;
    }
}

void MetaBunPlugin::Command_Test(int clientIndex, const char* args) {
    (void)args;
    
    float curtime = 0.0f;
#ifdef COMPILE_WITH_SOURCE_SDK
    if (m_pEngineServer) {
        auto globals = m_pEngineServer->GetServerGlobals();
        if (globals) curtime = globals->curtime;
    }
#endif

    // Rate limit: 2 seconds between tests to protect the server
    if (curtime - m_flLastTestCommandTime < 2.0f && m_flLastTestCommandTime > 0.0f) {
        std::string msg = "[MetaBun] Please wait " + std::to_string(2.0f - (curtime - m_flLastTestCommandTime)) + "s before testing again.\n";
        if (clientIndex == 0) std::cout << msg;
        else m_pEngineServer->ClientCommand(clientIndex - 1, ("echo " + msg).c_str());
        return;
    }
    m_flLastTestCommandTime = curtime;

    std::cout << "[MetaBun Test] Running dynamic schema lookup test..." << std::endl;
    
    // Testing lookups for common CS2 classes
    int healthOffset = g_SchemaManager.GetOffset("CBaseEntity", "m_iHealth");
    int teamOffset = g_SchemaManager.GetOffset("CBaseEntity", "m_iTeamNum");
    int moneyOffset = g_SchemaManager.GetOffset("CCSPlayerController", "m_pInGameMoneyServices");

    std::string results = "[MetaBun Test Results]\n"
                          "CBaseEntity::m_iHealth -> Offset: " + std::to_string(healthOffset) + "\n"
                          "CBaseEntity::m_iTeamNum -> Offset: " + std::to_string(teamOffset) + "\n"
                          "CCSPlayerController::m_pInGameMoneyServices -> Offset: " + std::to_string(moneyOffset) + "\n";

    if (clientIndex == 0) std::cout << results;
    else m_pEngineServer->ClientCommand(clientIndex - 1, ("echo \"" + results + "\"").c_str());
}

// ─── Game Event Forwarders ────────────────────────────────────────────────────

void MetaBunPlugin::OnGameFrame() {
    m_SdkHooks.OnGameFrame();
    float curtime = 0.0f;
#ifdef COMPILE_WITH_SOURCE_SDK
    if (m_pEngineServer) {
        auto globals = m_pEngineServer->GetServerGlobals();
        if (globals) curtime = globals->curtime;
    }
#endif
    m_PlayerStats.OnGameFrame(curtime);
}

bool MetaBunPlugin::OnClientConnect(int clientIndex,
                                    const char *name,
                                    const char *steamId,
                                    int userId,
                                    bool isBot,
                                    const char *ip,
                                    const char *language) {
    m_PlayerStats.TrackPlayer(clientIndex);
    return m_SdkHooks.OnClientConnect(clientIndex, name, steamId, userId, isBot, ip, language);
}

void MetaBunPlugin::OnClientDisconnect(int clientIndex, const std::string& reason) {
    m_PlayerStats.UntrackPlayer(clientIndex);
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
                int val = std::stoi(text);
                if (val == 0) {
                    m_MenuHandler.OnMenuSelect(clientIndex, -1);
                    return; // Intercepted
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

void MetaBunPlugin::OnPlayerSpawn(int clientIndex, int team) {
    m_SdkHooks.OnPlayerSpawn(clientIndex, team);
}

void MetaBunPlugin::OnPlayerDeath(int victimIndex, int attackerIndex, int assisterIndex, bool headshot, const std::string& weapon) {
    m_SdkHooks.OnPlayerDeath(victimIndex, attackerIndex, assisterIndex, headshot, weapon);
}

void MetaBunPlugin::OnWeaponChange(int clientIndex, const std::string& weaponName) {
    m_SdkHooks.OnWeaponChange(clientIndex, weaponName);
}

int MetaBunPlugin::OnTakeDamage(int victim, int attacker, float damage, int damageType, int weaponEntity) {
    return m_SdkHooks.OnTakeDamage(victim, attacker, damage, damageType, weaponEntity);
}

void MetaBunPlugin::OnRoundStart(int timelimit, int fraglimit) {
    if (!m_EventManager.IsHooked("RoundStart") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "RoundStart";
    j["timelimit"] = timelimit;
    j["fraglimit"] = fraglimit;
    Send(j);
}

void MetaBunPlugin::OnRoundEnd(int winner, int reason) {
    if (!m_EventManager.IsHooked("RoundEnd") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "RoundEnd";
    j["winner"] = winner;
    j["reason"] = reason;
    Send(j);
}

void MetaBunPlugin::OnBombPlanted(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombPlanted") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "BombPlanted";
    j["client"] = clientIndex;
    j["site"] = site;
    Send(j);
}

void MetaBunPlugin::OnBombDefused(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombDefused") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "BombDefused";
    j["client"] = clientIndex;
    j["site"] = site;
    Send(j);
}

void MetaBunPlugin::OnBombExploded(int clientIndex, const std::string& site) {
    if (!m_EventManager.IsHooked("BombExploded") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "BombExploded";
    j["client"] = clientIndex;
    j["site"] = site;
    Send(j);
}

void MetaBunPlugin::OnHostageRescued(int clientIndex, int hostageIndex) {
    if (!m_EventManager.IsHooked("HostageRescued") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "HostageRescued";
    j["client"] = clientIndex;
    j["hostage"] = hostageIndex;
    Send(j);
}

void MetaBunPlugin::OnItemPickup(int clientIndex, const std::string& item) {
    if (!m_EventManager.IsHooked("ItemPickup") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "ItemPickup";
    j["client"] = clientIndex;
    j["item"] = item;
    Send(j);
}

void MetaBunPlugin::OnWeaponFire(int clientIndex, const std::string& weapon) {
    if (!m_EventManager.IsHooked("WeaponFire") || !m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "WeaponFire";
    j["client"] = clientIndex;
    j["weapon"] = weapon;
    Send(j);
}

void MetaBunPlugin::OnMapStart(const std::string& mapName) {
    if (!m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "MapStart";
    j["mapName"] = mapName;
    Send(j);
}

void MetaBunPlugin::OnMapEnd() {
    if (!m_Bridge.IsConnected()) return;
    njson j;
    j["event"] = "MapEnd";
    Send(j);
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

void MetaBunPlugin::HandleActionSay(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("text");
    if (it != p.end() && m_pEngineServer) {
        std::string formatted = ColorUtils::FormatColors(it->second);
        // Source 2 uses ServerCommand for simple chat broadcast in many plugins
        // Alternatively, use engine->ClientCommand for specific client
        std::string cmd = "say \"" + formatted + "\"\n";
        m_pEngineServer->ServerCommand(cmd.c_str());
    }
}

void MetaBunPlugin::HandleActionSayToClient(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("text");
    if (cIt != p.end() && tIt != p.end() && m_pEngineServer) {
        int clientIndex = std::atoi(cIt->second.c_str());
        std::string formatted = ColorUtils::FormatColors(tIt->second);
        std::string cmd = "say \"" + formatted + "\"\n";
        // Convert 1-based index back to 0-based for engine
        m_pEngineServer->ClientCommand(clientIndex - 1, cmd.c_str());
    }
}

void MetaBunPlugin::HandleActionCommand(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("command");
    if (it != p.end() && m_pEngineServer) {
        m_pEngineServer->ServerCommand((it->second + "\n").c_str());
    }
}

void MetaBunPlugin::HandleActionPrint(
        const std::unordered_map<std::string, std::string>& p) {
    auto it = p.find("text");
    if (it != p.end()) {
        std::cout << it->second << std::endl;
    }
}

void MetaBunPlugin::HandleActionKick(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto rIt = p.find("reason");
    if (cIt != p.end() && m_pEngineServer) {
        int clientIndex = std::atoi(cIt->second.c_str());
        std::string reason = (rIt != p.end()) ? rIt->second : "Kicked by Admin";
        std::ostringstream cmd;
        cmd << "kickid " << clientIndex << " \"" << reason << "\"\n";
        m_pEngineServer->ServerCommand(cmd.str().c_str());
    }
}

void MetaBunPlugin::HandleActionBan(
        const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto dIt = p.find("duration");
    auto rIt = p.find("reason");
    if (cIt != p.end() && m_pEngineServer) {
        int clientIndex = std::atoi(cIt->second.c_str());
        int duration = (dIt != p.end()) ? std::atoi(dIt->second.c_str()) : 0;
        std::string reason = (rIt != p.end()) ? rIt->second : "Banned by Admin";
        std::ostringstream cmd;
        // Simplified ban logic via server commands
        cmd << "banid " << duration << " " << clientIndex << " kick \"" << reason << "\"\n";
        m_pEngineServer->ServerCommand(cmd.str().c_str());
    }
}

void MetaBunPlugin::HandleActionMenu(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto iIt = p.find("id");
    auto tIt = p.find("title");
    auto itemsIt = p.find("items");
    
    if (cIt == p.end() || iIt == p.end() || tIt == p.end() || itemsIt == p.end()) return;

    int client = std::atoi(cIt->second.c_str());
    std::string id = iIt->second;
    std::string title = tIt->second;
    
    auto jsonItems = json_utils::ParseMenuItemsJSON(itemsIt->second);
    std::vector<MenuHandler::MenuItem> items;
    for (const auto& ji : jsonItems) {
        items.push_back({ ji.display, ji.info });
    }
    
    auto sIt = p.find("subTitle");
    auto fIt = p.find("footer");
    auto typeIt = p.find("type");
    
    std::string sub = (sIt != p.end()) ? sIt->second : "";
    std::string foot = (fIt != p.end()) ? fIt->second : "";
    int type = (typeIt != p.end()) ? std::atoi(typeIt->second.c_str()) : 0;

    m_MenuHandler.ShowMenuExtended(client, id, title, sub, foot, type, items);
}

void MetaBunPlugin::HandleActionCancelVote(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
    if (m_pEngineServer) m_pEngineServer->ServerCommand("vote_cancel\n");
}

void MetaBunPlugin::HandleActionHookEvent(const std::unordered_map<std::string, std::string>& p) {
    auto eIt = p.find("event");
    if (eIt != p.end()) m_EventManager.HookEvent(eIt->second);
}

void MetaBunPlugin::HandleActionUnhookEvent(const std::unordered_map<std::string, std::string>& p) {
    auto eIt = p.find("event");
    if (eIt != p.end()) m_EventManager.UnhookEvent(eIt->second);
}

void MetaBunPlugin::HandleActionHookSDK(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("type");
    if (cIt != p.end() && tIt != p.end()) {
        m_SdkHooks.HookSDK(std::atoi(cIt->second.c_str()), std::atoi(tIt->second.c_str()));
    }
}

void MetaBunPlugin::HandleActionUnhookSDK(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("type");
    if (cIt != p.end() && tIt != p.end()) {
        m_SdkHooks.UnhookSDK(std::atoi(cIt->second.c_str()), std::atoi(tIt->second.c_str()));
    }
}

void MetaBunPlugin::HandleActionSDKHookDecision(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("type");
    auto dIt = p.find("decision");
    if (cIt != p.end() && tIt != p.end() && dIt != p.end()) {
        m_SdkHooks.SetSDKHookDecision(std::atoi(cIt->second.c_str()), 
                                      std::atoi(tIt->second.c_str()), 
                                      std::atoi(dIt->second.c_str()));
    }
}

void MetaBunPlugin::HandleActionCvarRegister(const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto dIt = p.find("default");
    auto hIt = p.find("help");
    if (nIt != p.end() && dIt != p.end()) {
        std::string desc = (hIt != p.end()) ? hIt->second : "";
        m_CvarManager.RegisterConVar(nIt->second, dIt->second, desc);
    }
}

void MetaBunPlugin::HandleActionCvarSet(const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto vIt = p.find("value");
    if (nIt != p.end() && vIt != p.end()) {
        m_CvarManager.SetConVar(nIt->second, vIt->second);
    }
}

void MetaBunPlugin::HandleActionCvarGet(const std::unordered_map<std::string, std::string>& p) {
    auto nIt = p.find("name");
    auto rIt = p.find("requestId");
    if (nIt != p.end() && rIt != p.end()) {
        std::string name = nIt->second;
        std::string reqId = rIt->second;
        std::string value = m_CvarManager.GetConVar(name);
        
        njson j;
        j["event"] = "CvarValueResponse";
        j["name"] = name;
        j["value"] = value;
        j["requestId"] = reqId;
        Send(j);
    }
}

void MetaBunPlugin::HandleActionClientCommand(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto cmdIt = p.find("command");
    if (cIt != p.end() && cmdIt != p.end() && m_pEngineServer) {
        int clientIndex = std::atoi(cIt->second.c_str());
        m_pEngineServer->ClientCommand(clientIndex - 1, (cmdIt->second + "\n").c_str());
    }
}

void MetaBunPlugin::HandleActionClanTag(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
    // CS2 schema specific: CCSPlayerController.m_szClan
}

void MetaBunPlugin::HandleActionSetVelocity(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
    // CS2 schema specific: CBaseEntity.m_vecVelocity
}

void MetaBunPlugin::HandleActionForcedObserver(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
}

void MetaBunPlugin::HandleActionPong(const std::unordered_map<std::string, std::string>& p) {
    auto tIt = p.find("timestamp_ms");
    if (tIt != p.end()) m_Bridge.HandlePong(std::stoll(tIt->second));
}

void MetaBunPlugin::HandleActionRegisterCommand(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
}

void MetaBunPlugin::HandleActionUnregisterCommand(const std::unordered_map<std::string, std::string>& p) {
    (void)p;
}

void MetaBunPlugin::HandleActionSlap(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto dIt = p.find("damage");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int damage = (dIt != p.end()) ? std::atoi(dIt->second.c_str()) : 0;

#ifdef COMPILE_WITH_SOURCE_SDK
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
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_teleport " << client << " " << xIt->second << " " << yIt->second << " " << zIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Teleport client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetTeam(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("team");
    if (cIt == p.end() || tIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
    int team = std::atoi(tIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
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
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_gravity " << client << " " << gIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetGravity client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetMoveType(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto mIt = p.find("movetype");
    if (cIt == p.end() || mIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_movetype " << client << " " << mIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetMoveType client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetHealth(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto hIt = p.find("health");
    if (cIt == p.end() || hIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_health " << client << " " << hIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetHealth client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetModel(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto mIt = p.find("model");
    if (cIt == p.end() || mIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_model " << client << " \"" << mIt->second << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetModel client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetRenderColor(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::cout << "[MetaBun] SetRenderColor not fully mapped yet for client: " << client << std::endl;
#else
    std::cout << "[MetaBun Mock] SetRenderColor client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionPlaySound(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto sIt = p.find("sound");
    if (cIt == p.end() || sIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_playsound " << client << " \"" << sIt->second << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] PlaySound client=" << client << " sound=\"" << sIt->second << "\"" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionHint(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto tIt = p.find("text");
    if (cIt == p.end() || tIt == p.end() || !m_pEngineServer) return;

    int client = std::atoi(cIt->second.c_str());
    std::string text = tIt->second;

#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_hint " << client << " \"" << text << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] Hint client=" << client << " text=\"" << text << "\"" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionGiveItem(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto iIt = p.find("item");
    if (cIt == p.end() || iIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_give " << client << " \"" << iIt->second << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] GiveItem client=" << client << " item=\"" << iIt->second << "\"" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionRemoveItem(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto iIt = p.find("item");
    if (cIt == p.end() || iIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_removeitem " << client << " \"" << iIt->second << "\"\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] RemoveItem client=" << client << " item=\"" << iIt->second << "\"" << std::endl;
#endif
}

void MetaBunPlugin::HandleActionSetAmmo(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    auto wIt = p.find("weapon");
    auto aIt = p.find("ammo");
    if (cIt == p.end() || wIt == p.end() || aIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::ostringstream cmd;
    cmd << "sm_setammo " << client << " \"" << wIt->second << "\" " << aIt->second << "\n";
    m_pEngineServer->ServerCommand(cmd.str().c_str());
#else
    std::cout << "[MetaBun Mock] SetAmmo client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionUnban(const std::unordered_map<std::string, std::string>& p) {
    auto aIt = p.find("auth");
    if (aIt != p.end() && m_pEngineServer) {
        m_pEngineServer->ServerCommand(("unban " + aIt->second + "\n").c_str());
    }
}

void MetaBunPlugin::HandleActionScreenFade(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::cout << "[MetaBun] ScreenFade not fully mapped yet for client: " << client << std::endl;
#else
    std::cout << "[MetaBun Mock] ScreenFade client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionScreenShake(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("client");
    if (cIt == p.end() || !m_pEngineServer) return;
    int client = std::atoi(cIt->second.c_str());
#ifdef COMPILE_WITH_SOURCE_SDK
    std::cout << "[MetaBun] ScreenShake not fully mapped yet for client: " << client << std::endl;
#else
    std::cout << "[MetaBun Mock] ScreenShake client=" << client << std::endl;
#endif
}

void MetaBunPlugin::HandleActionCreateEntity(const std::unordered_map<std::string, std::string>& p) {
    auto cIt = p.find("class_name");
    if (cIt == p.end() || !m_pEngineServer) return;
    std::string className = cIt->second;
#ifdef COMPILE_WITH_SOURCE_SDK
    if (m_pServerTools) {
        void* entity = m_pServerTools->CreateEntityByName(className.c_str());
        if (entity) {
            m_pServerTools->DispatchSpawn(entity);
            std::cout << "[MetaBun] Entity spawned: " << className << std::endl;
        } else {
            std::cerr << "[MetaBun] Failed to create entity: " << className << std::endl;
        }
    } else {
        std::cerr << "[MetaBun] IServerTools not available, cannot create entity: " << className << std::endl;
        m_pEngineServer->ServerCommand(("ent_create " + className + "\n").c_str());
    }
#else
    std::cout << "[MetaBun Mock] CreateEntity: " << className << std::endl;
#endif
}
