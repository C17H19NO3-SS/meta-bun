#include "event_manager.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>
#include <sstream>

EventManager::EventManager()
    : m_pBridge(nullptr), m_OnFire(nullptr) {}

EventManager::~EventManager() {
    UnhookAll();
}

void EventManager::Initialize(BridgeClient* bridge, EventFireCallback onFire) {
    m_pBridge = bridge;
    m_OnFire  = onFire;
}

void EventManager::HookEvent(const std::string& eventName) {
    if (m_HookedEvents.count(eventName)) {
        // Zaten hook'lu — tekrar kayıt gerekmez
        return;
    }
    m_HookedEvents.insert(eventName);
    std::cout << "[MetaBun EventManager] Hooked event: " << eventName << std::endl;
}

void EventManager::UnhookEvent(const std::string& eventName) {
    if (!m_HookedEvents.count(eventName)) {
        return;
    }
    m_HookedEvents.erase(eventName);
    std::cout << "[MetaBun EventManager] Unhooked event: " << eventName << std::endl;
}

bool EventManager::IsHooked(const std::string& eventName) const {
    return m_HookedEvents.count(eventName) > 0;
}

const std::unordered_set<std::string>& EventManager::GetHookedEvents() const {
    return m_HookedEvents;
}

void EventManager::DispatchEvent(
        const std::string& eventName,
        const std::unordered_map<std::string, std::string>& fields) {

    if (!IsHooked(eventName)) {
        // Bun bu event'i dinlemiyorsa gönderme
        return;
    }
    if (!m_pBridge || !m_pBridge->IsConnected()) {
        return;
    }

    std::string payload = BuildJsonPayload(eventName, fields);

    if (m_OnFire) {
        m_OnFire(eventName, payload);
    } else {
        m_pBridge->Send(payload);
    }
}

void EventManager::UnhookAll() {
    if (!m_HookedEvents.empty()) {
        std::cout << "[MetaBun EventManager] Unhooked all "
                  << m_HookedEvents.size() << " events." << std::endl;
        m_HookedEvents.clear();
    }
}

// ─── Private ────────────────────────────────────────────────────────────────

std::string EventManager::BuildJsonPayload(
        const std::string& eventName,
        const std::unordered_map<std::string, std::string>& fields) const {

    std::ostringstream ss;
    ss << "{\"event\":\"" << json::EscapeString(eventName) << "\"";

    for (const auto& kv : fields) {
        ss << ",\"" << json::EscapeString(kv.first)
           << "\":\"" << json::EscapeString(kv.second) << "\"";
    }

    ss << "}\n";
    return ss.str();
}
