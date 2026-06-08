#include "sdk_hooks.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

SDKHooks::SDKHooks() : m_pBridge(nullptr) {}
SDKHooks::~SDKHooks() {}

void SDKHooks::Initialize(BridgeClient* bridge) { m_pBridge = bridge; }

void SDKHooks::HookSDK(int client, int hookType) {
    m_ActiveSDKHooks[client].insert(hookType);
}

void SDKHooks::UnhookSDK(int client, int hookType) {
    auto it = m_ActiveSDKHooks.find(client);
    if (it != m_ActiveSDKHooks.end()) {
        it->second.erase(hookType);
        if (it->second.empty()) m_ActiveSDKHooks.erase(it);
    }
}

void SDKHooks::OnGameFrame() {}

bool SDKHooks::OnClientConnect(int clientIndex, const char* name, const char* steamId, int userId, bool isBot, const char* ip, const char* language) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return true;
    njson j;
    j["event"] = "PlayerConnect"; j["client"] = clientIndex; j["name"] = name; j["steamid"] = steamId;
    j["userid"] = userId; j["isBot"] = isBot; if (ip && *ip) j["ip"] = ip; j["language"] = language;
    m_pBridge->Send(j);
    return true;
}

void SDKHooks::OnClientDisconnect(int clientIndex, const std::string& reason) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "PlayerDisconnect"; j["client"] = clientIndex; j["reason"] = reason;
    m_pBridge->Send(j);
}

void SDKHooks::OnClientPostAdminCheck(int clientIndex) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "OnClientPostAdminCheck"; j["client"] = clientIndex;
    m_pBridge->Send(j);
}

void SDKHooks::OnPlayerChat(int clientIndex, const std::string& text) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "PlayerChat"; j["client"] = clientIndex; j["text"] = text;
    m_pBridge->Send(j);
}

void SDKHooks::OnPlayerSpawn(int clientIndex, int team) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "PlayerSpawn"; j["client"] = clientIndex; j["team"] = team;
    m_pBridge->Send(j);
}

void SDKHooks::OnPlayerDeath(int victimIndex, int attackerIndex, int assisterIndex, bool headshot, const std::string& weapon) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j;
    j["event"] = "PlayerDeath"; j["client"] = victimIndex; j["attacker"] = attackerIndex;
    if (assisterIndex >= 0) j["assister"] = assisterIndex;
    j["headshot"] = headshot; j["weapon"] = weapon;
    m_pBridge->Send(j);
}

void SDKHooks::OnWeaponChange(int clientIndex, const std::string& weaponName) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "WeaponChange"; j["client"] = clientIndex; j["weapon"] = weaponName;
    m_pBridge->Send(j);
}

void SDKHooks::OnPlayerStatsUpdate(int clientIndex, int health, int armor, int money, int team, bool isAlive, float x, float y, float z, float ax, float ay, float az, float vx, float vy, float vz, bool isObserver, int observerTarget, int entityFlags, int ping) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j;
    j["event"] = "PlayerStatsUpdate"; j["client"] = clientIndex; j["health"] = health; j["armor"] = armor;
    j["money"] = money; j["team"] = team; j["isAlive"] = isAlive;
    j["pos"] = { {"x", x}, {"y", y}, {"z", z} };
    j["ang"] = { {"x", ax}, {"y", ay}, {"z", az} };
    j["vel"] = { {"x", vx}, {"y", vy}, {"z", vz} };
    j["isObserver"] = isObserver; j["observerTarget"] = observerTarget; j["entityFlags"] = entityFlags; j["ping"] = ping;
    m_pBridge->Send(j);
}

int SDKHooks::OnTakeDamage(int victim, int attacker, float damage, int damageType, int weaponEntity) { return TriggerSDKHook(victim, 1, victim, attacker, damage, damageType, weaponEntity); }
int SDKHooks::WeaponCanUse(int client, int weaponEntity) { return TriggerSDKHook(client, 2, client, weaponEntity); }
int SDKHooks::TraceAttack(int victim, int attacker, float damage, int damageType, int weaponEntity) { return TriggerSDKHook(victim, 3, victim, attacker, damage, damageType, weaponEntity); }
int SDKHooks::PreThink(int client) { return TriggerSDKHook(client, 4, client); }
int SDKHooks::PostThink(int client) { return TriggerSDKHook(client, 5, client); }
int SDKHooks::OnEntityCreated(int entity) { return TriggerSDKHook(0, 6, entity); }
int SDKHooks::OnEntityDeleted(int entity) { return TriggerSDKHook(0, 7, entity); }
int SDKHooks::Touch(int entity, int other) { return TriggerSDKHook(entity, 8, entity, other); }

int SDKHooks::TriggerSDKHook(int client, int hookType, ...) {
    int key = client * 100 + hookType;
    if (m_SDKHookDecisions.count(key) && m_SDKHookDecisions[key] != 0) {
        int d = m_SDKHookDecisions[key]; m_SDKHookDecisions.erase(key); return d;
    }
    if (m_pBridge && m_pBridge->IsConnected() && m_ActiveSDKHooks[client].count(hookType)) {
        njson j; j["event"] = "SDKHook_Trigger"; j["client"] = client; j["type"] = hookType;
        m_pBridge->Send(j);
    }
    return 0;
}

void SDKHooks::SetSDKHookDecision(int client, int hookType, int decision) {
    m_SDKHookDecisions[client * 100 + hookType] = decision;
}
