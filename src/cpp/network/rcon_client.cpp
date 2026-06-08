#include "rcon_client.h"
#include <cstring>
#include <iostream>
#include <vector>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "Ws2_32.lib")
    static inline int p_recv(SocketType s, char* b, int l) { return ::recv(s, b, l, 0); }
    static inline int p_send(SocketType s, const char* b, int l) { return ::send(s, b, l, 0); }
    static inline void p_close(SocketType s) { ::closesocket(s); }
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    static inline int p_recv(SocketType s, char* b, int l) { return (int)::recv(s, b, l, 0); }
    static inline int p_send(SocketType s, const char* b, int l) { return (int)::send(s, b, l, 0); }
    static inline void p_close(SocketType s) { ::close(s); }
#endif

RconClient::RconClient() : m_Port(0), m_Socket(INVALID_SOCKET), m_IsConnected(false), m_ShouldRun(false) {}
RconClient::~RconClient() { Disconnect(); }

bool RconClient::Connect(const std::string& host, int port, const std::string& password) {
    if (m_IsConnected.load()) Disconnect();
    m_Host = host; m_Port = port; m_Password = password;
#ifdef _WIN32
    WSADATA w; WSAStartup(MAKEWORD(2,2), &w);
#endif
    struct sockaddr_in addr; std::memset(&addr, 0, sizeof(addr)); addr.sin_family = AF_INET; addr.sin_port = htons(port);
#ifdef _WIN32
    addr.sin_addr.s_addr = inet_addr(host.c_str());
#else
    if (inet_pton(AF_INET, host.c_str(), &addr.sin_addr) <= 0) return false;
#endif
    m_Socket = socket(AF_INET, SOCK_STREAM, 0);
    if (m_Socket == INVALID_SOCKET || connect(m_Socket, (struct sockaddr*)&addr, sizeof(addr)) == SOCKET_ERROR) {
        if (m_Socket != INVALID_SOCKET) {
            p_close(m_Socket);
        }
        return false;
    }
    m_IsConnected.store(true); m_ShouldRun.store(true);
    m_ReceiveThread = std::thread(&RconClient::ReceiveLoop, this);
    return true;
}

void RconClient::Disconnect() {
    m_ShouldRun.store(false); m_IsConnected.store(false);
    if (m_Socket != INVALID_SOCKET) { p_close(m_Socket); m_Socket = INVALID_SOCKET; }
    if (m_ReceiveThread.joinable()) m_ReceiveThread.join();
}

bool RconClient::SendCommand(const std::string& command) {
    if (!m_IsConnected.load()) return false;
    njson j; j["password"] = m_Password; j["command"] = command;
    std::vector<uint8_t> mp = njson::to_msgpack(j);
    uint32_t len = (uint32_t)mp.size();
    uint8_t h[4] = { (uint8_t)(len>>24), (uint8_t)(len>>16), (uint8_t)(len>>8), (uint8_t)len };
    std::lock_guard<std::mutex> lock(m_SendMutex);
    if (p_send(m_Socket, (char*)h, 4) != 4) return false;
    return p_send(m_Socket, (char*)mp.data(), (int)len) == (int)len;
}

bool RconClient::IsConnected() const { return m_IsConnected.load(); }
void RconClient::SetResponseCallback(ResponseCallback cb) { m_ResponseCallback = std::move(cb); }

void RconClient::ReceiveLoop() {
    std::vector<uint8_t> acc; uint8_t buf[4096];
    while (m_ShouldRun.load()) {
        int r = p_recv(m_Socket, (char*)buf, sizeof(buf));
        if (r <= 0) break;
        acc.insert(acc.end(), buf, buf + r);
        while (acc.size() >= 4) {
            uint32_t len = (uint32_t(acc[0])<<24) | (uint32_t(acc[1])<<16) | (uint32_t(acc[2])<<8) | uint32_t(acc[3]);
            if (acc.size() >= 4 + len) {
                try {
                    njson j = njson::from_msgpack(std::vector<uint8_t>(acc.begin()+4, acc.begin()+4+len));
                    if (j.contains("response") && m_ResponseCallback) m_ResponseCallback(j["response"]);
                } catch (...) {}
                acc.erase(acc.begin(), acc.begin() + 4 + len);
            } else break;
        }
    }
    m_IsConnected.store(false);
}
