#include "event_manager.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

EventManager::EventManager() : m_pBridge(nullptr), m_OnFire(nullptr) {}
EventManager::~EventManager() {}

void EventManager::Initialize(BridgeClient* bridge, EventFireCallback onFire) {
    m_pBridge = bridge; m_OnFire = onFire;
}

void EventManager::HookEvent(const std::string& eventName) {
    m_HookedEvents.insert(eventName);
}

void EventManager::UnhookEvent(const std::string& eventName) {
    m_HookedEvents.erase(eventName);
}

bool EventManager::IsHooked(const std::string& eventName) const {
    return m_HookedEvents.count(eventName) > 0;
}

void EventManager::DispatchEvent(const std::string& eventName, const std::unordered_map<std::string, std::string>& fields) {
    if (!IsHooked(eventName) || !m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = eventName;
    for (const auto& kv : fields) j[kv.first] = kv.second;
    if (m_OnFire) m_OnFire(eventName, j.dump());
    else m_pBridge->Send(j);
}

void EventManager::UnhookAll() {
    m_HookedEvents.clear();
}
