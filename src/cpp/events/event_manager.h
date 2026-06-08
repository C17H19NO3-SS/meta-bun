#ifndef _INCLUDE_METABUN_EVENT_MANAGER_H_
#define _INCLUDE_METABUN_EVENT_MANAGER_H_

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

class BridgeClient;

class EventManager {
public:
    typedef std::function<void(const std::string&, const std::string&)> EventFireCallback;

    EventManager();
    ~EventManager();

    void Initialize(BridgeClient* bridge, EventFireCallback onFire = nullptr);
    void HookEvent(const std::string& eventName);
    void UnhookEvent(const std::string& eventName);
    bool IsHooked(const std::string& eventName) const;
    const std::unordered_set<std::string>& GetHookedEvents() const { return m_HookedEvents; }

    void DispatchEvent(const std::string& eventName, const std::unordered_map<std::string, std::string>& fields);
    void UnhookAll();

private:
    BridgeClient*    m_pBridge;
    EventFireCallback m_OnFire;
    std::unordered_set<std::string> m_HookedEvents;
};

#endif // _INCLUDE_METABUN_EVENT_MANAGER_H_
