#ifndef _INCLUDE_METABUN_SDK_MOCK_H_
#define _INCLUDE_METABUN_SDK_MOCK_H_

#ifdef COMPILE_WITH_SOURCE_SDK
    // Include real HL2SDK / Metamod headers
    #include <ISmmPlugin.h>
    #include <eiface.h>
    #include <convar.h>
    #include <igameevents.h>
    #include <game/server/iplayerinfo.h>
    using SourceMM::PluginId;
    using SourceMM::ISmmAPI;
#else
    // Minimal mock definitions for Source/Metamod SDKs to compile locally
    #include <string>
    #include <vector>
    
    enum PlAction {
        Pl_Continue = 0,
        Pl_Handled = 3,
        Pl_Stop = 4
    };

    class IConVar {
    public:
        virtual const char* GetName() = 0;
        virtual const char* GetString() = 0;
    };

    typedef void (*FnChangeCallback_t)(IConVar *var, const char *pOldValue, float flOldValue);

    class ConVar : public IConVar {
    public:
        ConVar(const char *pName, const char *pDefaultValue, int flags, const char *pHelpString, FnChangeCallback_t callback)
            : m_Name(pName), m_Value(pDefaultValue), m_Help(pHelpString), m_Callback(callback) {}
        
        const char* GetName() override { return m_Name.c_str(); }
        const char* GetString() override { return m_Value.c_str(); }
        void SetValue(const char* pValue) {
            std::string old = m_Value;
            m_Value = pValue;
            if (m_Callback) {
                m_Callback(this, old.c_str(), 0.0f);
            }
        }
    private:
        std::string m_Name;
        std::string m_Value;
        std::string m_Help;
        FnChangeCallback_t m_Callback;
    };

    class ICvar {
    public:
        virtual void RegisterConVar(ConVar* pVar) = 0;
        virtual ConVar* FindVar(const char* pVarName) = 0;
    };

    namespace SourceMM {
        typedef int PluginId;
        class ISmmAPI {
        public:
            virtual bool RegisterConCommand(ConVar* pCommand) = 0;
        };

        class ISmmPlugin {
        public:
            virtual bool Load(PluginId id, ISmmAPI *ismm, char *error, size_t maxlen, bool late) = 0;
            virtual bool Unload(char *error, size_t maxlen) = 0;
            virtual const char *GetAuthor() = 0;
            virtual const char *GetName() = 0;
            virtual const char *GetDescription() = 0;
            virtual const char *GetURL() = 0;
            virtual const char *GetLicense() = 0;
            virtual const char *GetVersion() = 0;
            virtual const char *GetDate() = 0;
            virtual const char *GetLogTag() = 0;
        };
    }
    using SourceMM::ISmmPlugin;
    using SourceMM::ISmmAPI;
    using SourceMM::PluginId;

    class IVEngineServer {
    public:
        virtual void ServerCommand(const char* cmd) = 0;
        virtual void ClientCommand(int clientIndex, const char* cmd) = 0;
    };

    class IPlayerInfo {
    public:
        virtual const char* GetName() = 0;
        virtual const char* GetNetworkIDString() = 0;
        virtual int GetUserID() = 0;
        virtual bool IsFakeClient() = 0;
    };

    class IPlayerInfoManager {
    public:
        virtual IPlayerInfo* GetPlayerInfo(int clientIndex) = 0;
    };

    class IGameEvent {
    public:
        virtual const char* GetName() = 0;
        virtual int GetInt(const char* key, int def = 0) = 0;
        virtual const char* GetString(const char* key, const char* def = "") = 0;
    };

#endif // COMPILE_WITH_SOURCE_SDK

#endif // _INCLUDE_METABUN_SDK_MOCK_H_
