#include "player_stats.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>

PlayerStatsCollector::PlayerStatsCollector() : m_pBridge(nullptr), m_MaxClients(0), m_SendInterval(8), m_FrameCounter(0) {}
PlayerStatsCollector::~PlayerStatsCollector() {}

void PlayerStatsCollector::Initialize(BridgeClient* bridge, StatsFetchCallback fetch, int maxClients, int interval) {
    m_pBridge = bridge; m_FetchCallback = fetch; m_MaxClients = maxClients; m_SendInterval = interval;
}

void PlayerStatsCollector::OnGameFrame(float curtime) {
    if (!m_pBridge || !m_pBridge->IsConnected() || !m_FetchCallback) return;
    if (++m_FrameCounter < m_SendInterval) return;
    m_FrameCounter = 0;
    for (auto const& [clientIndex, tracked] : m_TrackedClients) {
        if (tracked) SendStats(m_FetchCallback(clientIndex), curtime);
    }
}

void PlayerStatsCollector::TrackPlayer(int clientIndex) { m_TrackedClients[clientIndex] = true; }
void PlayerStatsCollector::UntrackPlayer(int clientIndex) { m_TrackedClients.erase(clientIndex); }

void PlayerStatsCollector::SendStats(const PlayerStats& s, float time) {
    njson j; j["event"] = "PlayerStatsUpdate"; j["client"] = s.client; j["health"] = s.health;
    j["armor"] = s.armor; j["money"] = s.money; j["team"] = s.team; j["isAlive"] = s.isAlive;
    j["engineTime"] = time; j["maxClients"] = m_MaxClients;
    j["pos"] = { {"x", s.x}, {"y", s.y}, {"z", s.z} };
    j["ang"] = { {"x", s.ax}, {"y", s.ay}, {"z", s.az} };
    j["vel"] = { {"x", s.vx}, {"y", s.vy}, {"z", s.vz} };
    j["isObserver"] = s.isObserver; j["observerTarget"] = s.observerTarget;
    j["entityFlags"] = s.entityFlags; j["buttons"] = s.buttons;
    j["clip1"] = s.clip1; j["reserve1"] = s.reserve1; j["clanTag"] = s.clanTag; j["ping"] = s.ping;
    m_pBridge->Send(j);
}
