#ifndef _INCLUDE_METABUN_CONVAR_MANAGER_H_
#define _INCLUDE_METABUN_CONVAR_MANAGER_H_

#include <string>
#include <unordered_map>
#include <functional>

#ifdef COMPILE_WITH_SOURCE_SDK
    #include <icvar.h>
    #include <convar.h>
    typedef CConVar<CUtlString> ConVarType;
#else
    class ICvar;
    class ConVar;
    class IConVar;
    typedef ConVar ConVarType;
#endif

class BridgeClient;

/**
 * ConVarManager — Source Engine ConVar kayıt/okuma/yazma yöneticisi.
 *
 * ConVar değişikliklerini hem plugin callback'ine hem de (eğer bridge
 * bağlıysa) Bun'a {"event":"ConVarChanged","name":"...","value":"..."}
 * formatında iletir.
 */
class ConVarManager {
public:
    /// ConVar değiştiğinde tetiklenen (name, newValue) callback typedef'i.
    typedef std::function<void(const std::string&, const std::string&)> ConVarChangeCallback;

    ConVarManager();
    ~ConVarManager();

    /**
     * ICvar arayüzü ve değişiklik callback'i ile başlat.
     * @param cvarInterface  Source Engine ICvar pointer'ı.
     * @param callback       ConVar değiştiğinde çağrılacak fonksiyon.
     */
    void Initialize(ICvar* cvarInterface, ConVarChangeCallback callback);

    /**
     * Bridge pointer'ı ayarla.
     *
     * Ayarlandıktan sonra her ConVar değişikliğinde bridge üzerinden
     * Bun'a şu JSON satırı gönderilir:
     *   {"event":"ConVarChanged","name":"<isim>","value":"<değer>"}
     *
     * @param bridge  BridgeClient pointer'ı; nullptr ile devre dışı bırakılır.
     */
    void SetBridge(BridgeClient* bridge);

    /**
     * Yeni bir ConVar kaydeder.
     * @param name          ConVar adı (ör. "sv_cheats").
     * @param defaultValue  Varsayılan string değer.
     * @param description   Yardım metni.
     * @return Başarıyla kayıt edildiyse true; zaten kayıtlıysa da true döner.
     */
    bool RegisterConVar(const std::string& name, const std::string& defaultValue,
                        const std::string& description);

    /**
     * Var olan bir ConVar'ın değerini değiştirir.
     * @return Başarıysa true, ConVar bulunamazsa false.
     */
    bool SetConVar(const std::string& name, const std::string& value);

    /**
     * ConVar değerini string olarak döndürür; bulunamazsa boş string.
     */
    std::string GetConVar(const std::string& name);

    /**
     * Source Engine'in ConVar change callback'i — singleton üzerinden çalışır.
     */
#ifdef COMPILE_WITH_SOURCE_SDK
    static void OnConVarChanged(CConVar<CUtlString> *cvar, CSplitScreenSlot nSlot, const CUtlString *pNewValue, const CUtlString *pOldValue);
#else
    static void OnConVarChangedGlobal(IConVar* var, const char* pOldValue, float flOldValue);
#endif

private:
    ICvar*               m_pCvarInterface; ///< Source Engine ICvar arayüzü
    BridgeClient*        m_pBridge;        ///< ConVarChanged event'i göndermek için
    ConVarChangeCallback m_ChangeCallback; ///< Plugin taraflı callback
    std::unordered_map<std::string, ConVarType*> m_ConVars; ///< Yönetilen ConVar'lar
};

#endif // _INCLUDE_METABUN_CONVAR_MANAGER_H_
