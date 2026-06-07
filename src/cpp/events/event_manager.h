#ifndef _INCLUDE_METABUN_EVENT_MANAGER_H_
#define _INCLUDE_METABUN_EVENT_MANAGER_H_

#include <string>
#include <unordered_set>
#include <unordered_map>
#include <functional>

class BridgeClient;

/**
 * EventManager — dinamik olarak game eventlerini C++ Metamod katmanına
 * hooklar ve gelen event verilerini JSON formatında Bun runtime'a iletir.
 *
 * Bun tarafındaki PluginManager "newListener" eventinde dinamik olarak
 * {"action":"hook_event","event":"PlayerDeath"} mesajı gönderir.
 * Bu mesaj alındığında EventManager o event için kaydolur.
 * Listener kalmayınca {"action":"unhook_event"} ile kaydı siler.
 */
class EventManager {
public:
    /**
     * IGameEventManager2::FireEvent çağrısında invoked olacak callback.
     * İlk parametre event adı, ikincisi JSON payload string'i.
     */
    using EventFireCallback = std::function<void(const std::string& eventName,
                                                  const std::string& jsonPayload)>;

    EventManager();
    ~EventManager();

    /**
     * Bridge istemcisini ve event iletim callback'ini ayarla.
     *
     * @param bridge     C++ → Bun TCP bağlantısı.
     * @param onFire     Bridge'e göndermek için callback.
     */
    void Initialize(BridgeClient* bridge, EventFireCallback onFire);

    /**
     * Verilen event adı için dinleyici kaydol.
     * Aynı event için birden fazla çağrı sessizce yoksayılır.
     *
     * @param eventName CS2 event adı (ör. "player_death").
     */
    void HookEvent(const std::string& eventName);

    /**
     * Verilen event adı için dinleyiciyi kaldır.
     *
     * @param eventName CS2 event adı.
     */
    void UnhookEvent(const std::string& eventName);

    /**
     * Belirli bir event'in hook'lu olup olmadığını sorgula.
     */
    bool IsHooked(const std::string& eventName) const;

    /**
     * Hook'lu tüm event adlarının setini döndür.
     */
    const std::unordered_set<std::string>& GetHookedEvents() const;

    /**
     * SDK'dan gelen ham event verisini işle ve JSON'a dönüştürerek
     * Bun'a ilet.  Gerçek implementasyonda IGameEvent* parametre olur;
     * burada mock uyumlu basit string map versiyonu sağlanır.
     *
     * @param eventName  Hook'lanan event adı.
     * @param fields     Event alanları: alan adı → string değer.
     */
    void DispatchEvent(const std::string& eventName,
                       const std::unordered_map<std::string, std::string>& fields);

    /**
     * Tüm hookları temizle (plugin unload sırasında çağrılır).
     */
    void UnhookAll();

private:
    /**
     * Verilen alanlardan NDJSON payload'u üret.
     * Format: {"event":"<name>","<key>":"<val>",...}\n
     */
    std::string BuildJsonPayload(
        const std::string& eventName,
        const std::unordered_map<std::string, std::string>& fields) const;

    BridgeClient*    m_pBridge;
    EventFireCallback m_OnFire;

    /** Şu an aktif hook'lu event adları. */
    std::unordered_set<std::string> m_HookedEvents;
};

#endif // _INCLUDE_METABUN_EVENT_MANAGER_H_
