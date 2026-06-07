#ifndef _INCLUDE_METABUN_PLAYER_STATS_H_
#define _INCLUDE_METABUN_PLAYER_STATS_H_

#include <string>
#include <unordered_map>
#include <chrono>
#include <functional>

class BridgeClient;

/**
 * PlayerStatsCollector — oyuncu durum verilerini (pozisyon, sağlık, para,
 * takım, hız, observer durumu, entity flag'leri) toplayarak periyodik olarak
 * PlayerStatsUpdate JSON olayı şeklinde Bun runtime'a iletir.
 */
class PlayerStatsCollector {
public:
    /**
     * Tek bir oyuncunun anlık istatistiklerini tutmak için yapı.
     */
    struct PlayerStats {
        int   client   = 0;
        int   health   = 100;
        int   armor    = 0;
        int   money    = 0;
        int   team     = 0;
        bool  isAlive  = true;

        // World coordinates
        float x = 0.0f, y = 0.0f, z = 0.0f;

        // View angles (pitch/yaw/roll)
        float ax = 0.0f, ay = 0.0f, az = 0.0f;

        // Velocity vector
        float vx = 0.0f, vy = 0.0f, vz = 0.0f;

        // Observer / spectator state
        bool isObserver    = false;
        int  observerTarget = 0;

        // Entity flag bitmask (FL_ONGROUND, FL_DUCKING, etc.)
        int entityFlags = 0;

        // Input buttons bitmask (IN_ATTACK, IN_JUMP, etc.)
        int buttons = 0;

        // Weapon ammo
        int clip1 = -1;
        int reserve1 = -1;

        std::string clanTag = "";

        /**
         * Player ping value (ms).
         * Read via INetChannel::GetAvgLatency() in CS2 SDK.
         * Sent as 0 in mock mode.
         */
        int ping = 0;
    };

    /**
     * Oyuncu istatistiklerini motorda okuyan fonksiyon.
     */
    using StatsFetchCallback = std::function<PlayerStats(int clientIndex)>;

    PlayerStatsCollector();
    ~PlayerStatsCollector();

    /**
     * Bridge ve istatistik okuma callback'ini ayarla.
     */
    void Initialize(BridgeClient* bridge,
                    StatsFetchCallback fetchCallback,
                    int maxClients,
                    int sendInterval = 8);

    /**
     * Her oyun frame'inde çağrılır.
     */
    void OnGameFrame(float curtime);

    /**
     * Bir oyuncu bağlandığında izlemeye ekle.
     */
    void TrackPlayer(int clientIndex);

    /**
     * Bir oyuncu ayrıldığında izlemeden çıkar.
     */
    void UntrackPlayer(int clientIndex);

private:
    /**
     * Verilen oyuncunun stats'ını JSON'a dönüştürüp Bun'a gönderir.
     */
    void SendStats(const PlayerStats& stats, float engineTime);

    /**
     * PlayerStats struct'ından NDJSON payload üretir.
     */
    std::string BuildPayload(const PlayerStats& stats, float engineTime, int maxClients) const;

    BridgeClient*       m_pBridge;
    StatsFetchCallback  m_FetchCallback;
    int                 m_MaxClients;
    int                 m_SendInterval;
    int                 m_FrameCounter;

    /** Takip edilen client indexlerin seti. */
    std::unordered_map<int, bool> m_TrackedClients;
};

#endif // _INCLUDE_METABUN_PLAYER_STATS_H_
