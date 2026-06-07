#include "player_stats.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <sstream>
#include <iostream>
#include <iomanip>
#include <cmath>

// float → string dönüşümü için yardımcı (2 ondalık basamak)
static std::string FloatToString(float v) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2) << v;
    return ss.str();
}

// ─── Ctor / Dtor ─────────────────────────────────────────────────────────────

PlayerStatsCollector::PlayerStatsCollector()
    : m_pBridge(nullptr)
    , m_FetchCallback(nullptr)
    , m_MaxClients(64)
    , m_SendInterval(8)
    , m_FrameCounter(0)
{}

PlayerStatsCollector::~PlayerStatsCollector() {
    m_TrackedClients.clear();
}

// ─── Public ──────────────────────────────────────────────────────────────────

void PlayerStatsCollector::Initialize(BridgeClient* bridge,
                                      StatsFetchCallback fetchCallback,
                                      int maxClients,
                                      int sendInterval) {
    m_pBridge       = bridge;
    m_FetchCallback = fetchCallback;
    m_MaxClients    = maxClients;
    m_SendInterval  = (sendInterval > 0) ? sendInterval : 8;
    m_FrameCounter  = 0;

    std::cout << "[MetaBun PlayerStats] Initialized. Interval: every "
              << m_SendInterval << " frames. MaxClients: "
              << m_MaxClients << std::endl;
}

void PlayerStatsCollector::OnGameFrame(float curtime) {
    ++m_FrameCounter;

    // Sadece her sendInterval frame'de bir gönder
    if (m_FrameCounter % m_SendInterval != 0) {
        return;
    }

    if (!m_pBridge || !m_pBridge->IsConnected()) {
        return;
    }

    if (!m_FetchCallback) {
        return;
    }

    // İzlenen tüm oyuncular için istatistik gönder
    for (auto& [clientIndex, active] : m_TrackedClients) {
        if (!active) continue;

        PlayerStats stats = m_FetchCallback(clientIndex);
        if (stats.client <= 0) continue;

        SendStats(stats, curtime);
    }
}

void PlayerStatsCollector::TrackPlayer(int clientIndex) {
    if (clientIndex <= 0 || clientIndex > m_MaxClients) {
        return;
    }
    m_TrackedClients[clientIndex] = true;
    std::cout << "[MetaBun PlayerStats] Tracking client " << clientIndex << std::endl;
}

void PlayerStatsCollector::UntrackPlayer(int clientIndex) {
    auto it = m_TrackedClients.find(clientIndex);
    if (it != m_TrackedClients.end()) {
        m_TrackedClients.erase(it);
        std::cout << "[MetaBun PlayerStats] Untracked client " << clientIndex << std::endl;
    }
}

// ─── Private ─────────────────────────────────────────────────────────────────

void PlayerStatsCollector::SendStats(const PlayerStats& stats, float engineTime) {
    std::string payload = BuildPayload(stats, engineTime, m_MaxClients);
    m_pBridge->Send(payload);
}

std::string PlayerStatsCollector::BuildPayload(const PlayerStats& stats, float engineTime, int maxClients) const {
    std::ostringstream ss;

    ss << "{"
       << "\"event\":\"PlayerStatsUpdate\","
       << "\"client\":"         << stats.client        << ","
       << "\"health\":"         << stats.health         << ","
       << "\"armor\":"          << stats.armor          << ","
       << "\"money\":"          << stats.money          << ","
       << "\"team\":"           << stats.team           << ","
       << "\"isAlive\":"        << (stats.isAlive  ? "true" : "false") << ","
       << "\"engineTime\":"     << FloatToString(engineTime) << ","
       << "\"maxClients\":"     << maxClients           << ","
       // Position
       << "\"x\":"              << FloatToString(stats.x) << ","
       << "\"y\":"              << FloatToString(stats.y) << ","
       << "\"z\":"              << FloatToString(stats.z) << ","
       // Angles
       << "\"ax\":"             << FloatToString(stats.ax) << ","
       << "\"ay\":"             << FloatToString(stats.ay) << ","
       << "\"az\":"             << FloatToString(stats.az) << ","
       // Velocity
       << "\"vx\":"             << FloatToString(stats.vx) << ","
       << "\"vy\":"             << FloatToString(stats.vy) << ","
       << "\"vz\":"             << FloatToString(stats.vz) << ","
       // Observer
       << "\"isObserver\":"     << (stats.isObserver ? "true" : "false") << ","
       << "\"observerTarget\":" << stats.observerTarget << ","
       // Entity flags & buttons
       << "\"entityFlags\":"    << stats.entityFlags << ","
       << "\"buttons\":"        << stats.buttons << ","
       // Ammo
       << "\"clip1\":"          << stats.clip1 << ","
       << "\"reserve1\":"       << stats.reserve1 << ","
       // Clan Tag
       << "\"clanTag\":\""      << json::EscapeString(stats.clanTag) << "\","
       // Ping (ms)
       << "\"ping\":"           << stats.ping
       << "}\n";

    return ss.str();
}
