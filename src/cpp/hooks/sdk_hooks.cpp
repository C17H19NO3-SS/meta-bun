#include "sdk_hooks.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>
#include <sstream>

// ---------------------------------------------------------------------------
// Ctor / Dtor
// ---------------------------------------------------------------------------

SDKHooks::SDKHooks() : m_pBridge(nullptr) {}

SDKHooks::~SDKHooks() {}

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

void SDKHooks::Initialize(BridgeClient* bridge) {
    m_pBridge = bridge;
}

// ---------------------------------------------------------------------------
// HookSDK / UnhookSDK
// ---------------------------------------------------------------------------

void SDKHooks::HookSDK(int client, int hookType) {
    m_ActiveSDKHooks[client].insert(hookType);
    std::cout << "[MetaBun Hooks] Registered SDK Hook " << hookType
              << " for client " << client << std::endl;
}

void SDKHooks::UnhookSDK(int client, int hookType) {
    auto it = m_ActiveSDKHooks.find(client);
    if (it != m_ActiveSDKHooks.end()) {
        it->second.erase(hookType);
        if (it->second.empty()) {
            m_ActiveSDKHooks.erase(it);
        }
        std::cout << "[MetaBun Hooks] Unregistered SDK Hook " << hookType
                  << " for client " << client << std::endl;
    }
}

// ---------------------------------------------------------------------------
// OnGameFrame
// ---------------------------------------------------------------------------

void SDKHooks::OnGameFrame() {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    // Frame başına yapılacak işler buraya eklenebilir.
}

// ---------------------------------------------------------------------------
// OnClientConnect
// ---------------------------------------------------------------------------

bool SDKHooks::OnClientConnect(int clientIndex, const std::string& name,
                                const std::string& steamId, int userId,
                                bool isBot, const std::string& ip,
                                const std::string& language) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return true;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerConnect\","
       << "\"client\":"  << clientIndex                          << ","
       << "\"name\":\""  << json::EscapeString(name)            << "\","
       << "\"steamid\":\"" << json::EscapeString(steamId)       << "\","
       << "\"userid\":"  << userId                               << ","
       << "\"isBot\":"   << (isBot ? "true" : "false");

    // ip yalnızca doluysa JSON'a eklenir
    if (!ip.empty()) {
        ss << ",\"ip\":\"" << json::EscapeString(ip) << "\"";
    }

    // language her zaman eklenir
    ss << ",\"language\":\"" << json::EscapeString(language) << "\"";

    ss << "}\n";

    m_pBridge->Send(ss.str());
    return true;
}

// ---------------------------------------------------------------------------
// OnClientDisconnect
// ---------------------------------------------------------------------------

void SDKHooks::OnClientDisconnect(int clientIndex, const std::string& reason) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerDisconnect\","
       << "\"client\":"  << clientIndex                      << ","
       << "\"reason\":\"" << json::EscapeString(reason) << "\"}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnPlayerChat
// ---------------------------------------------------------------------------

void SDKHooks::OnPlayerChat(int clientIndex, const std::string& text) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerChat\","
       << "\"client\":" << clientIndex                  << ","
       << "\"text\":\"" << json::EscapeString(text) << "\"}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnPlayerSpawn
// ---------------------------------------------------------------------------

void SDKHooks::OnPlayerSpawn(int clientIndex, int team) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerSpawn\","
       << "\"client\":" << clientIndex << ","
       << "\"team\":"   << team        << "}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnPlayerDeath
// ---------------------------------------------------------------------------

void SDKHooks::OnPlayerDeath(int victimIndex, int attackerIndex,
                              int assisterIndex, bool headshot,
                              const std::string& weapon) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerDeath\","
       << "\"client\":"   << victimIndex                        << ","
       << "\"attacker\":" << attackerIndex;

    // assisterIndex == -1 ise alan hiç eklenmez
    if (assisterIndex >= 0) {
        ss << ",\"assister\":" << assisterIndex;
    }

    ss << ",\"headshot\":" << (headshot ? "true" : "false")
       << ",\"weapon\":\"" << json::EscapeString(weapon) << "\"}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnWeaponChange
// ---------------------------------------------------------------------------

void SDKHooks::OnWeaponChange(int clientIndex, const std::string& weaponName) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"WeaponChange\","
       << "\"client\":"   << clientIndex                             << ","
       << "\"weapon\":\"" << json::EscapeString(weaponName) << "\"}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnPlayerStatsUpdate
// ---------------------------------------------------------------------------

void SDKHooks::OnPlayerStatsUpdate(int clientIndex, int health, int armor,
                                    int money, int team, bool isAlive,
                                    float x, float y, float z,
                                    float ax, float ay, float az,
                                    float vx, float vy, float vz,
                                    bool isObserver, int observerTarget,
                                    int entityFlags, int ping) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"PlayerStatsUpdate\","
       << "\"client\":"         << clientIndex                          << ","
       << "\"health\":"         << health                               << ","
       << "\"armor\":"          << armor                                << ","
       << "\"money\":"          << money                                << ","
       << "\"team\":"           << team                                 << ","
       << "\"isAlive\":"        << (isAlive ? "true" : "false")        << ","
       << "\"pos\":{"
           << "\"x\":"          << x                                    << ","
           << "\"y\":"          << y                                    << ","
           << "\"z\":"          << z
       << "},"
       << "\"ang\":{"
           << "\"x\":"          << ax                                   << ","
           << "\"y\":"          << ay                                   << ","
           << "\"z\":"          << az
       << "},"
       << "\"vel\":{"
           << "\"x\":"          << vx                                   << ","
           << "\"y\":"          << vy                                   << ","
           << "\"z\":"          << vz
       << "},"
       << "\"isObserver\":"     << (isObserver ? "true" : "false")     << ","
       << "\"observerTarget\":" << observerTarget                       << ","
       << "\"entityFlags\":"    << entityFlags                          << ","
       << "\"ping\":"           << ping
       << "}\n";

    m_pBridge->Send(ss.str());
}

// ---------------------------------------------------------------------------
// OnTakeDamage
// ---------------------------------------------------------------------------

int SDKHooks::OnTakeDamage(int victim, int attacker, float damage,
                            int damageType, int weaponEntity) {
    return TriggerSDKHook(victim, 1, victim, attacker, damage, damageType, weaponEntity);
}

int SDKHooks::WeaponCanUse(int client, int weaponEntity) {
    return TriggerSDKHook(client, 2, client, weaponEntity);
}

int SDKHooks::TraceAttack(int victim, int attacker, float damage, int damageType, int weaponEntity) {
    return TriggerSDKHook(victim, 3, victim, attacker, damage, damageType, weaponEntity);
}

int SDKHooks::PreThink(int client) {
    return TriggerSDKHook(client, 4, client);
}

int SDKHooks::PostThink(int client) {
    return TriggerSDKHook(client, 5, client);
}

int SDKHooks::OnEntityCreated(int entity) {
    return TriggerSDKHook(0, 6, entity);
}

int SDKHooks::OnEntityDeleted(int entity) {
    return TriggerSDKHook(0, 7, entity);
}

int SDKHooks::Touch(int entity, int other) {
    return TriggerSDKHook(entity, 8, entity, other);
}

int SDKHooks::TriggerSDKHook(int client, int hookType, ...) {
    // Önce önbellekten (one-shot) karar var mı kontrol et
    int decisionKey = client * 100 + hookType;
    auto decIt = m_SDKHookDecisions.find(decisionKey);
    if (decIt != m_SDKHookDecisions.end() && decIt->second != 0) {
        int decision = decIt->second;
        m_SDKHookDecisions.erase(decIt); // one-shot
        return decision;
    }

    if (!m_pBridge || !m_pBridge->IsConnected()) return 0;

    auto hookIt = m_ActiveSDKHooks.find(client);
    if (hookIt != m_ActiveSDKHooks.end() && hookIt->second.count(hookType)) {
        std::ostringstream ss;
        ss << "{\"event\":\"SDKHook_Trigger\","
           << "\"client\":"   << client   << ","
           << "\"type\":"     << hookType << "}\n";
        m_pBridge->Send(ss.str());
    }

    return 0;
}

// ---------------------------------------------------------------------------
// SetSDKHookDecision
// ---------------------------------------------------------------------------

void SDKHooks::SetSDKHookDecision(int client, int hookType, int decision) {
    m_SDKHookDecisions[client * 100 + hookType] = decision;
}

// ---------------------------------------------------------------------------
// OnClientPostAdminCheck
// ---------------------------------------------------------------------------

void SDKHooks::OnClientPostAdminCheck(int clientIndex) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;

    std::ostringstream ss;
    ss << "{\"event\":\"OnClientPostAdminCheck\","
       << "\"client\":" << clientIndex << "}\n";

    m_pBridge->Send(ss.str());
}
