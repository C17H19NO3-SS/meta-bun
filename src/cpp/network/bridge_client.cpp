#include "bridge_client.h"
#include <iostream>
#include <cstring>
#include <chrono>
#include <algorithm>
#include <vector>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    static inline int p_recv(SocketType s, char* b, int l) { return ::recv(s, b, l, 0); }
    static inline int p_send(SocketType s, const char* b, int l) { return ::send(s, b, l, 0); }
    static inline void p_close(SocketType s) { ::closesocket(s); }
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR   (-1)
    static inline int p_recv(SocketType s, char* b, int l) { return (int)::recv(s, b, (size_t)l, 0); }
    static inline int p_send(SocketType s, const char* b, int l) { return (int)::send(s, b, (size_t)l, 0); }
    static inline void p_close(SocketType s) { ::close(s); }
#endif

static long long NowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

BridgeClient::BridgeClient() : m_Port(0), m_Protocol("ndjson"), m_Socket(INVALID_SOCKET), m_IsConnected(false), m_IsAuthenticated(false), m_ShouldRun(false), m_LatencyMs(-1.0), m_PingIntervalMs(5000) {
#ifdef _WIN32
    WSADATA w; WSAStartup(MAKEWORD(2, 2), &w);
#endif
}

BridgeClient::~BridgeClient() {
    Stop();
#ifdef _WIN32
    WSACleanup();
#endif
}

bool BridgeClient::Start(const std::string& h, int p, const std::string& t) {
    m_Host = h; m_Port = p; m_Token = t; m_ShouldRun = true;
    m_ConnectionThread = std::thread(&BridgeClient::ConnectionLoop, this);
    return true;
}

void BridgeClient::Stop() {
    m_ShouldRun = false; CleanupSocket();
    if (m_ConnectionThread.joinable()) m_ConnectionThread.join();
    if (m_ReceiveThread.joinable()) m_ReceiveThread.join();
}

bool BridgeClient::IsConnected() const { return m_IsConnected.load(); }
double BridgeClient::GetLatencyMs() const { return m_LatencyMs.load(); }
void BridgeClient::RegisterCallback(IncomingMessageCallback cb) { m_Callback = std::move(cb); }
void BridgeClient::SetProtocol(const std::string& pr) { m_Protocol = pr; }
void BridgeClient::SetReconnectCallback(ReconnectCallback cb) { m_ReconnectCallback = std::move(cb); }

bool BridgeClient::Send(const njson& obj) {
    std::vector<uint8_t> mp = njson::to_msgpack(obj);
    return Send(std::string(mp.begin(), mp.end()));
}

bool BridgeClient::Send(const std::string& raw) {
    if (!m_IsConnected.load() || m_Socket == INVALID_SOCKET) return false;
    std::lock_guard<std::mutex> lock(m_SendMutex);
    uint32_t len = (uint32_t)raw.size();
    uint8_t h[4] = { (uint8_t)(len>>24), (uint8_t)(len>>16), (uint8_t)(len>>8), (uint8_t)len };
    std::string f = std::string((char*)h, 4) + raw;
    const char* d = f.data(); size_t left = f.size();
    while (left > 0) {
        int s = p_send(m_Socket, d, (int)left);
        if (s == SOCKET_ERROR) { CleanupSocket(); return false; }
        left -= s; d += s;
    }
    return true;
}

void BridgeClient::SendPing() { njson j; j["event"] = "ping"; j["timestamp_ms"] = NowMs(); Send(j); }
void BridgeClient::HandlePong(long long ts) { double rtt = (double)(NowMs() - ts); if (rtt >= 0) m_LatencyMs.store(rtt); }

void BridgeClient::HandleAuthResponse(const std::string& line) {
    if (line.find("auth_success") != std::string::npos) {
        std::cout << "[MetaBun Bridge] Auth success." << std::endl;
        m_IsAuthenticated.store(true, std::memory_order_release);
    } else if (line.find("auth_failed") != std::string::npos) {
        CleanupSocket();
    }
}

void BridgeClient::CleanupSocket() {
    m_IsConnected.store(false); m_IsAuthenticated.store(false);
    if (m_Socket != INVALID_SOCKET) { p_close(m_Socket); m_Socket = INVALID_SOCKET; }
}

bool BridgeClient::EstablishConnection() {
    CleanupSocket(); m_Socket = socket(AF_INET, SOCK_STREAM, 0); if (m_Socket == INVALID_SOCKET) return false;
    struct sockaddr_in addr; std::memset(&addr, 0, sizeof(addr)); addr.sin_family = AF_INET; addr.sin_port = htons(m_Port);
#ifdef _WIN32
    addr.sin_addr.s_addr = inet_addr(m_Host.c_str());
#else
    if (inet_pton(AF_INET, m_Host.c_str(), &addr.sin_addr) <= 0) return false;
#endif
    if (connect(m_Socket, (struct sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) { CleanupSocket(); return false; }
    m_IsConnected.store(true, std::memory_order_release);
    if (!m_Token.empty()) { njson a; a["event"]="auth"; a["token"]=m_Token; Send(a); }
    else m_IsAuthenticated.store(true);
    return true;
}

void BridgeClient::ConnectionLoop() {
    while (m_ShouldRun.load()) {
        if (!m_IsConnected.load()) {
            if (EstablishConnection()) {
                if (m_ReceiveThread.joinable()) m_ReceiveThread.join();
                m_ReceiveThread = std::thread(&BridgeClient::ReceiveLoop, this);
                while (m_ShouldRun.load() && m_IsConnected.load() && !m_IsAuthenticated.load()) std::this_thread::sleep_for(std::chrono::milliseconds(50));
                if (m_IsAuthenticated.load()) { if (m_ReconnectCallback) m_ReconnectCallback(); m_LastPingTime = std::chrono::steady_clock::now(); }
            } else std::this_thread::sleep_for(std::chrono::seconds(3));
        } else {
            auto now = std::chrono::steady_clock::now();
            if (m_IsAuthenticated.load() && std::chrono::duration_cast<std::chrono::milliseconds>(now - m_LastPingTime).count() >= m_PingIntervalMs) {
                m_LastPingTime = now; SendPing();
            }
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    }
}

void BridgeClient::ReceiveLoop() {
    std::vector<uint8_t> acc; uint8_t buf[65536];
    while (m_ShouldRun.load() && m_IsConnected.load()) {
        int r = p_recv(m_Socket, (char*)buf, sizeof(buf));
        if (r <= 0) { CleanupSocket(); break; }
        acc.insert(acc.end(), buf, buf + r);
        while (acc.size() >= 4) {
            uint32_t len = (uint32_t(acc[0])<<24) | (uint32_t(acc[1])<<16) | (uint32_t(acc[2])<<8) | uint32_t(acc[3]);
            if (acc.size() >= 4 + len) {
                std::string p((char*)acc.data() + 4, len); acc.erase(acc.begin(), acc.begin() + 4 + len);
                if (!m_IsAuthenticated.load()) HandleAuthResponse(p);
                if (m_IsAuthenticated.load() && m_Callback) m_Callback(p);
            } else break;
        }
    }
}
