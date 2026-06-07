#include "convar_manager.h"
#include "../core/sdk_mock.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include <iostream>
#include <sstream>

/// Singleton — OnConVarChangedGlobal'ın instance'a erişmesi için.
static ConVarManager* g_pConVarManagerInstance = nullptr;

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

ConVarManager::ConVarManager()
    : m_pCvarInterface(nullptr)
    , m_pBridge(nullptr)
    , m_ChangeCallback(nullptr)
{
    g_pConVarManagerInstance = this;
}

ConVarManager::~ConVarManager() {
    for (auto& pair : m_ConVars) {
        delete pair.second;
    }
    m_ConVars.clear();

    if (g_pConVarManagerInstance == this) {
        g_pConVarManagerInstance = nullptr;
    }
}

// ---------------------------------------------------------------------------
// Public — Initialize / SetBridge
// ---------------------------------------------------------------------------

void ConVarManager::Initialize(ICvar* cvarInterface, ConVarChangeCallback callback) {
    m_pCvarInterface = cvarInterface;
    m_ChangeCallback = callback;
}

void ConVarManager::SetBridge(BridgeClient* bridge) {
    m_pBridge = bridge;
}

// ---------------------------------------------------------------------------
// Static callback — Source Engine ConVar change hook
// ---------------------------------------------------------------------------

#ifdef COMPILE_WITH_SOURCE_SDK
void ConVarManager::OnConVarChanged(CConVar<CUtlString> *cvar, CSplitScreenSlot nSlot, const CUtlString *pNewValue, const CUtlString *pOldValue) {
    (void)nSlot;
    (void)pOldValue;

    if (!g_pConVarManagerInstance) return;
    if (!cvar || !pNewValue) return;

    const std::string name  = cvar->GetName();
    const std::string value = pNewValue->Get();

    // Plugin callback'i varsa çağır
    if (g_pConVarManagerInstance->m_ChangeCallback) {
        g_pConVarManagerInstance->m_ChangeCallback(name, value);
    }

    // Bun bridge'e ConVarChanged eventi gönder
    BridgeClient* bridge = g_pConVarManagerInstance->m_pBridge;
    if (bridge && bridge->IsConnected()) {
        // JSON özel karakterlerden kaçış uygula (json_helper.h)
        const std::string safeName  = json::EscapeString(name);
        const std::string safeValue = json::EscapeString(value);

        std::ostringstream ss;
        ss << "{\"event\":\"ConVarChanged\","
           << "\"name\":\""  << safeName  << "\","
           << "\"value\":\"" << safeValue << "\""
           << "}\n";
        bridge->Send(ss.str());
    }
}
#else
void ConVarManager::OnConVarChangedGlobal(IConVar* var, const char* pOldValue, float flOldValue) {
    (void)flOldValue; // Kullanılmıyor

    if (!g_pConVarManagerInstance) return;
    if (!var) return;

    const std::string name  = var->GetName();
    const std::string value = var->GetString();

    // Plugin callback'i varsa çağır
    if (g_pConVarManagerInstance->m_ChangeCallback) {
        g_pConVarManagerInstance->m_ChangeCallback(name, value);
    }

    // Bun bridge'e ConVarChanged eventi gönder
    BridgeClient* bridge = g_pConVarManagerInstance->m_pBridge;
    if (bridge && bridge->IsConnected()) {
        // JSON özel karakterlerden kaçış uygula (json_helper.h)
        const std::string safeName  = json::EscapeString(name);
        const std::string safeValue = json::EscapeString(value);

        std::ostringstream ss;
        ss << "{\"event\":\"ConVarChanged\","
           << "\"name\":\""  << safeName  << "\","
           << "\"value\":\"" << safeValue << "\""
           << "}\n";
        bridge->Send(ss.str());
    }
}
#endif

// ---------------------------------------------------------------------------
// Public — ConVar CRUD
// ---------------------------------------------------------------------------

bool ConVarManager::RegisterConVar(const std::string& name,
                                   const std::string& defaultValue,
                                   const std::string& description)
{
    if (!m_pCvarInterface) return false;

    // Zaten kayıtlıysa tekrar ekleme
    if (m_ConVars.find(name) != m_ConVars.end()) {
        return true;
    }

#ifdef COMPILE_WITH_SOURCE_SDK
    CConVar<CUtlString>* pVar = new CConVar<CUtlString>(
        name.c_str(),
        0,
        description.c_str(),
        CUtlString(defaultValue.c_str()),
        &ConVarManager::OnConVarChanged
    );
#else
    ConVar* pVar = new ConVar(
        name.c_str(),
        defaultValue.c_str(),
        0,
        description.c_str(),
        &ConVarManager::OnConVarChangedGlobal
    );
    m_pCvarInterface->RegisterConVar(pVar);
#endif

    m_ConVars[name] = pVar;
    return true;
}

bool ConVarManager::SetConVar(const std::string& name, const std::string& value) {
    if (!m_pCvarInterface) return false;

    // Önce kendi kayıtlı ConVar'larımıza bak
    auto it = m_ConVars.find(name);
    if (it != m_ConVars.end()) {
#ifdef COMPILE_WITH_SOURCE_SDK
        it->second->SetString(CUtlString(value.c_str()));
#else
        it->second->SetValue(value.c_str());
#endif
        return true;
    }

    // Sonra engine ConVar listesinde ara
#ifdef COMPILE_WITH_SOURCE_SDK
    ConVarRefAbstract pVar = m_pCvarInterface->FindConVar(name.c_str());
    if (pVar.IsValidRef()) {
        pVar.SetString(CUtlString(value.c_str()));
        return true;
    }
#else
    ConVar* pVar = m_pCvarInterface->FindVar(name.c_str());
    if (pVar) {
        pVar->SetValue(value.c_str());
        return true;
    }
#endif

    return false;
}

std::string ConVarManager::GetConVar(const std::string& name) {
    if (!m_pCvarInterface) return "";

    auto it = m_ConVars.find(name);
    if (it != m_ConVars.end()) {
#ifdef COMPILE_WITH_SOURCE_SDK
        return it->second->GetString().Get();
#else
        return it->second->GetString();
#endif
    }

#ifdef COMPILE_WITH_SOURCE_SDK
    ConVarRefAbstract pVar = m_pCvarInterface->FindConVar(name.c_str());
    if (pVar.IsValidRef()) {
        return pVar.GetString().Get();
    }
#else
    ConVar* pVar = m_pCvarInterface->FindVar(name.c_str());
    if (pVar) {
        return pVar->GetString();
    }
#endif

    return "";
}
