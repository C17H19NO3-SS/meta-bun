#ifndef _INCLUDE_METABUN_BRIDGE_CLIENT_H_
#define _INCLUDE_METABUN_BRIDGE_CLIENT_H_

#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

#ifdef _WIN32
    #include <winsock2.h>
    typedef SOCKET SocketType;
#else
    typedef int SocketType;
#endif

class BridgeClient {
public:
    typedef std::function<void(const std::string&)> IncomingMessageCallback;
    typedef std::function<void()> ReconnectCallback;

    BridgeClient();
    ~BridgeClient();

    bool Start(const std::string& host, int port, const std::string& token);
    void Stop();

    bool Send(const njson& obj);
    bool Send(const std::string& rawPayload);

    void RegisterCallback(IncomingMessageCallback callback);
    void SetProtocol(const std::string& protocol);
    const std::string& GetProtocol() const { return m_Protocol; }
    void SetReconnectCallback(ReconnectCallback cb);

    bool IsConnected() const;
    double GetLatencyMs() const;
    void HandlePong(long long sentTimestampMs);

private:
    void ConnectionLoop();
    void ReceiveLoop();
    bool EstablishConnection();
    void CleanupSocket();
    void SendPing();
    void HandleAuthResponse(const std::string& line);

    std::string           m_Host;
    int                   m_Port;
    std::string           m_Token;
    std::string           m_Protocol;
    SocketType            m_Socket;
    std::atomic<bool>     m_IsConnected;
    std::atomic<bool>     m_IsAuthenticated;
    std::atomic<bool>     m_ShouldRun;

    std::thread           m_ConnectionThread;
    std::thread           m_ReceiveThread;
    std::mutex            m_SendMutex;

    IncomingMessageCallback m_Callback;
    ReconnectCallback       m_ReconnectCallback;

    std::atomic<double>                    m_LatencyMs;
    std::chrono::steady_clock::time_point  m_LastPingSentTime;
    int                                    m_PingIntervalMs;
    std::chrono::steady_clock::time_point  m_LastPingTime;
};

#endif // _INCLUDE_METABUN_BRIDGE_CLIENT_H_
