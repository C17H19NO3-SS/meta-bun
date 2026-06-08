#include "bridge_client.h"
#include <iostream>
#include <cstring>
#include <chrono>
#include <algorithm>
#include <vector>

#ifndef _WIN32
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR   (-1)
#endif

static long long NowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();
}

BridgeClient::BridgeClient() : m_Port(0), m_Protocol("ndjson"), m_Socket(INVALID_SOCKET), m_IsConnected(false), m_IsAuthenticated(false), m_ShouldRun(false), m_LatencyMs(-1.0), m_PingIntervalMs(5000) {
#ifdef _WIN32
    WSADATA wsaData; WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
}

BridgeClient::~BridgeClient() {
    Stop();
#ifdef _WIN32
    WSACleanup();
#endif
}

bool BridgeClient::Start(const std::string& host, int port, const std::string& token) {
    m_Host = host; m_Port = port; m_Token = token; m_ShouldRun = true;
    m_ConnectionThread = std::thread(&BridgeClient::ConnectionLoop, this);
    return true;
}

void BridgeClient::Stop() {
    m_ShouldRun = false; CleanupSocket();
    if (m_ConnectionThread.joinable()) m_ConnectionThread.join();
    if (m_ReceiveThread.joinable()) m_ReceiveThread.join();
}

bool BridgeClient::IsConnected() const { return m_IsConnected.load(std::memory_order_relaxed); }
double BridgeClient::GetLatencyMs() const { return m_LatencyMs.load(std::memory_order_relaxed); }
void BridgeClient::RegisterCallback(IncomingMessageCallback callback) { m_Callback = std::move(callback); }
void BridgeClient::SetProtocol(const std::string& protocol) { m_Protocol = protocol; }
void BridgeClient::SetReconnectCallback(ReconnectCallback cb) { m_ReconnectCallback = std::move(cb); }

bool BridgeClient::Send(const njson& obj) {
    if (m_Protocol == "length_prefixed_msgpack") {
        std::vector<uint8_t> msgpack = njson::to_msgpack(obj);
        return Send(std::string(msgpack.begin(), msgpack.end()));
    }
    return Send(obj.dump());
}

bool BridgeClient::Send(const std::string& rawPayload) {
    if (!m_IsConnected.load(std::memory_order_relaxed) || m_Socket == INVALID_SOCKET) return false;
    std::lock_guard<std::mutex> lock(m_SendMutex);
    std::string frame;
    if (m_Protocol == "ndjson") {
        frame = rawPayload; if (frame.empty() || frame.back() != '\n') frame += '\n';
    } else {
        uint32_t len = static_cast<uint32_t>(rawPayload.size());
        uint8_t h[4] = { (uint8_t)(len>>24), (uint8_t)(len>>16), (uint8_t)(len>>8), (uint8_t)len };
        frame = std::string((char*)h, 4) + rawPayload;
    }
    const char* p = frame.data(); size_t left = frame.size();
    while (left > 0) {
        int s = send(m_Socket, p, (int)left, 0);
        if (s == SOCKET_ERROR) { CleanupSocket(); return false; }
        left -= s; p += s;
    }
    return true;
}

void BridgeClient::SendPing() {
    njson j; j["event"] = "ping"; j["timestamp_ms"] = NowMs(); Send(j);
}

void BridgeClient::HandlePong(long long ts) {
    double rtt = (double)(NowMs() - ts); if (rtt >= 0) m_LatencyMs.store(rtt);
}

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
    if (m_Socket != INVALID_SOCKET) {
#ifdef _WIN32
        shutdown(m_Socket, SD_BOTH); closesocket(m_Socket);
#else
        shutdown(m_Socket, SHUT_RDWR); close(m_Socket);
#endif
        m_Socket = INVALID_SOCKET;
    }
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
    if (!m_Token.empty()) Send("{\"event\":\"auth\",\"token\":\"" + m_Token + "\"}");
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
        int r = recv(m_Socket, (char*)buf, sizeof(buf), 0);
        if (r <= 0) { CleanupSocket(); break; }
        acc.insert(acc.end(), buf, buf + r);
        if (m_Protocol == "ndjson") {
            auto it = acc.begin();
            while (it != acc.end()) {
                auto nl = std::find(it, acc.end(), '\n');
                if (nl != acc.end()) {
                    std::string line(it, nl); it = nl + 1;
                    if (!line.empty()) { HandleAuthResponse(line); if (m_IsAuthenticated.load() && m_Callback) m_Callback(line); }
                } else break;
            }
            acc.erase(acc.begin(), it);
        } else {
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
}
