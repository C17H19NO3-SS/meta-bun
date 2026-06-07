#ifndef _INCLUDE_METABUN_SDK_HOOKS_H_
#define _INCLUDE_METABUN_SDK_HOOKS_H_

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <functional>

class BridgeClient;

/**
 * SDKHooks — SourceMod SDK Hook olaylarını Bun köprüsüne ileten sınıf.
 *
 * Kullanım:
 *   SDKHooks hooks;
 *   hooks.Initialize(bridge);
 *   hooks.HookSDK(clientIndex, 1); // 1 = SDKHook_OnTakeDamage
 *   hooks.OnClientConnect(...);
 */
class SDKHooks {
public:
    SDKHooks();
    ~SDKHooks();

    /**
     * BridgeClient bağlantısını atar. Çağrılmadan diğer metotlar no-op olur.
     * @param bridge Aktif köprü istemcisi; nullptr kabul edilir (guard vardır).
     */
    void Initialize(BridgeClient* bridge);

    /**
     * Verilen client için hookType SDK hook'unu kaydeder.
     * @param client   SourceMod client index (1-based).
     * @param hookType SDKHookType tam sayısı (1=OnTakeDamage, 2=WeaponCanUse, ...).
     */
    void HookSDK(int client, int hookType);

    /**
     * Verilen client için hookType SDK hook kaydını siler.
     * Set boşalırsa map girişi de temizlenir.
     */
    void UnhookSDK(int client, int hookType);

    /**
     * Her oyun frame'inde çağrılır.
     * Bağlantı yoksa erken çıkar.
     */
    void OnGameFrame();

    /**
     * Oyuncu sunucuya bağlandığında çağrılır.
     * Bun'a PlayerConnect eventi gönderir.
     *
     * @param clientIndex SourceMod client index.
     * @param name        Oyuncu adı.
     * @param steamId     SteamID64 string'i.
     * @param userId      Sunucu userId'si.
     * @param isBot       Oyuncu bot mu?
     * @param ip          Bağlantı IP adresi ("192.168.1.1" formatı). Boşsa eklenmez.
     * @param language    Client dil kodu ("en", "tr" vb.). Her zaman eklenir.
     * @return            Bağlantıya izin verilmeli mi? (şimdilik her zaman true)
     */
    bool OnClientConnect(int clientIndex, const std::string& name,
                         const std::string& steamId, int userId,
                         bool isBot, const std::string& ip = "",
                         const std::string& language = "en");

    /**
     * Oyuncu sunucudan ayrıldığında çağrılır.
     * Bun'a PlayerDisconnect eventi gönderir.
     *
     * @param clientIndex SourceMod client index.
     * @param reason      Ayrılma sebebi.
     */
    void OnClientDisconnect(int clientIndex, const std::string& reason);

    /**
     * Oyuncu sohbet mesajı gönderdiğinde çağrılır.
     * Bun'a PlayerChat eventi gönderir.
     *
     * @param clientIndex SourceMod client index.
     * @param text        Sohbet mesajı (ham metin).
     */
    void OnPlayerChat(int clientIndex, const std::string& text);

    /**
     * Oyuncu spawn olduğunda çağrılır.
     * Bun'a PlayerSpawn eventi gönderir.
     *
     * @param clientIndex SourceMod client index.
     * @param team        Oyuncu takım numarası.
     */
    void OnPlayerSpawn(int clientIndex, int team);

    /**
     * Oyuncu öldüğünde çağrılır.
     * Bun'a PlayerDeath eventi gönderir.
     * assisterIndex == -1 ise JSON'a assister alanı eklenmez.
     *
     * @param victimIndex   Ölen oyuncu index'i.
     * @param attackerIndex Saldıran oyuncu index'i (0 = dünya/çevre).
     * @param assisterIndex Yardımcı oyuncu index'i; -1 ise yardım yok.
     * @param headshot      Kafa vuruşu mu?
     * @param weapon        Kullanılan silah adı ("weapon_ak47" vb.).
     */
    void OnPlayerDeath(int victimIndex, int attackerIndex,
                       int assisterIndex, bool headshot,
                       const std::string& weapon);

    /**
     * Oyuncunun aktif silahı değiştiğinde çağrılır.
     * Bun'a {"event":"WeaponChange","client":N,"weapon":"weapon_ak47"} gönderir.
     *
     * @param clientIndex SourceMod client index.
     * @param weaponName  Silah entity class adı.
     */
    void OnWeaponChange(int clientIndex, const std::string& weaponName);

    /**
     * Oyuncu istatistikleri güncellemesi gönderir.
     * Bun'a PlayerStatsUpdate eventi gönderir; ping alanını da içerir.
     *
     * @param clientIndex    SourceMod client index.
     * @param health         Mevcut can.
     * @param armor          Mevcut zırh.
     * @param money          Mevcut para.
     * @param team           Takım numarası.
     * @param isAlive        Oyuncu hayatta mı?
     * @param x, y, z        Pozisyon koordinatları.
     * @param ax, ay, az     Bakış açısı (angles).
     * @param vx, vy, vz     Velocity vektörü.
     * @param isObserver     Gözlemci modunda mı?
     * @param observerTarget Gözlemlenen hedef client index'i (-1 yok).
     * @param entityFlags    Entity flags bit maskesi.
     * @param ping           Client ping değeri (ms).
     */
    void OnPlayerStatsUpdate(int clientIndex, int health, int armor, int money,
                             int team, bool isAlive,
                             float x, float y, float z,
                             float ax, float ay, float az,
                             float vx, float vy, float vz,
                             bool isObserver, int observerTarget,
                             int entityFlags, int ping);

    /**
     * SDKHook OnTakeDamage callback'i.
     */
    int OnTakeDamage(int victim, int attacker, float damage,
                     int damageType, int weaponEntity);

    int WeaponCanUse(int client, int weaponEntity);
    int TraceAttack(int victim, int attacker, float damage, int damageType, int weaponEntity);
    int PreThink(int client);
    int PostThink(int client);
    int OnEntityCreated(int entity);
    int OnEntityDeleted(int entity);
    int Touch(int entity, int other);

    /**
     * Ortak hook tetikleyici ve karar mekanizması.
     */
    int TriggerSDKHook(int client, int hookType, ...);

    /**
     * Bun'dan gelen SDK hook karar önbelleğini günceller.
     * action="sdk_hook_decision" mesajı alındığında çağrılır.
     *
     * @param client   Etkilenen client index.
     * @param hookType SDKHookType (1=OnTakeDamage, 2=WeaponCanUse, ...).
     * @param decision Karar (0=geçir, 3=Plugin_Handled, 4=Plugin_Stop).
     */
    void SetSDKHookDecision(int client, int hookType, int decision);

    /**
     * Admin yetki kontrolü tamamlandıktan sonra çağrılır.
     * Bun'a {"event":"OnClientPostAdminCheck","client":N} gönderir.
     *
     * @param clientIndex SourceMod client index.
     */
    void OnClientPostAdminCheck(int clientIndex);

private:
    /** Köprü istemcisi — nullptr ise tüm event gönderimler no-op olur. */
    BridgeClient* m_pBridge;

    /**
     * Aktif SDK hook kayıtları.
     * key: client index, value: kayıtlı hookType değerleri kümesi.
     */
    std::unordered_map<int, std::unordered_set<int>> m_ActiveSDKHooks;

    /**
     * Bun'dan gelen SDK hook karar önbelleği (one-shot).
     * key: client * 100 + hookType
     * value: karar (0=geçir, 3=Handled, 4=Stop)
     *
     * OnTakeDamage her çağrıldığında önce bu önbelleğe bakılır;
     * karar bulunursa silinip döndürülür.
     */
    std::unordered_map<int, int> m_SDKHookDecisions;
};

#endif // _INCLUDE_METABUN_SDK_HOOKS_H_
