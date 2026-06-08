#ifndef _INCLUDE_METABUN_SDK_HOOKS_H_
#define _INCLUDE_METABUN_SDK_HOOKS_H_

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

class BridgeClient;

class SDKHooks {
public:
    SDKHooks();
    ~SDKHooks();

    void Initialize(BridgeClient* bridge);
    void HookSDK(int client, int hookType);
    void UnhookSDK(int client, int hookType);
    void OnGameFrame();

    bool OnClientConnect(int clientIndex, const char* name, const char* steamId, int userId, bool isBot, const char* ip, const char* language);
    void OnClientDisconnect(int clientIndex, const std::string& reason);
    void OnClientPostAdminCheck(int clientIndex);
    void OnPlayerChat(int clientIndex, const std::string& text);
    void OnPlayerSpawn(int clientIndex, int team);
    void OnPlayerDeath(int victimIndex, int attackerIndex, int assisterIndex, bool headshot, const std::string& weapon);
    void OnWeaponChange(int clientIndex, const std::string& weaponName);
    void OnPlayerStatsUpdate(int clientIndex, int health, int armor, int money, int team, bool isAlive, float x, float y, float z, float ax, float ay, float az, float vx, float vy, float vz, bool isObserver, int observerTarget, int entityFlags, int ping);

    int OnTakeDamage(int victim, int attacker, float damage, int damageType, int weaponEntity);
    int WeaponCanUse(int client, int weaponEntity);
    int TraceAttack(int victim, int attacker, float damage, int damageType, int weaponEntity);
    int PreThink(int client);
    int PostThink(int client);
    int OnEntityCreated(int entity);
    int OnEntityDeleted(int entity);
    int Touch(int entity, int other);

    void SetSDKHookDecision(int client, int hookType, int decision);

private:
    int TriggerSDKHook(int client, int hookType, ...);

    BridgeClient* m_pBridge;
    std::unordered_map<int, std::unordered_set<int>> m_ActiveSDKHooks;
    std::unordered_map<int, int> m_SDKHookDecisions;
};

#endif // _INCLUDE_METABUN_SDK_HOOKS_H_
