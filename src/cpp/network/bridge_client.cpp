/**
 * @file bridge_client.cpp
 * @brief TCP client implementation for the Bun runtime bridge.
 *
 * Wire protocols supported:
 *   "ndjson"                  — newline-delimited JSON (default)
 *   "length_prefixed_json"    — 4-byte big-endian uint32 length header + JSON
 *   "length_prefixed_msgpack" — same framing as length_prefixed_json
 *
 * Authentication flow (when a token is provided):
 *   1. EstablishConnection() sends {"event":"auth","token":"<tok>"}\n
 *   2. ReceiveLoop() passes every line to HandleAuthResponse()
 *   3. On "auth_success" → m_IsAuthenticated = true
 *      On "auth_failed"  → socket is closed (reconnect will retry)
 *
 * Latency measurement:
 *   ConnectionLoop() sends a ping every m_PingIntervalMs (default 5 s).
 *   The plugin must call HandlePong(sentTimestampMs) when it receives
 *   a {"action":"pong"} message so the RTT can be stored.
 */

#include "bridge_client.h"

#include <iostream>
#include <cstring>
#include <chrono>
#include <stdexcept>

// ── Platform socket headers ──────────────────────────────────────────────────
#ifndef _WIN32
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <unistd.h>
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR   (-1)
#endif

// ── Helper: current Unix time in milliseconds ────────────────────────────────
static long long NowMs() {
    using namespace std::chrono;
    return duration_cast<milliseconds>(
        steady_clock::now().time_since_epoch()
    ).count();
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor / Destructor
// ─────────────────────────────────────────────────────────────────────────────

BridgeClient::BridgeClient()
    : m_Port(0)
    , m_Protocol("ndjson")
    , m_Socket(INVALID_SOCKET)
    , m_IsConnected(false)
    , m_IsAuthenticated(false)
    , m_ShouldRun(false)
    , m_Callback(nullptr)
    , m_ReconnectCallback(nullptr)
    , m_LatencyMs(-1.0)
    , m_LastPingSentTime(std::chrono::steady_clock::now())
    , m_PingIntervalMs(5000)
    , m_LastPingTime(std::chrono::steady_clock::now())
{
#ifdef _WIN32
    WSADATA wsaData;
    WSAStartup(MAKEWORD(2, 2), &wsaData);
#endif
}

BridgeClient::~BridgeClient() {
    Stop();
#ifdef _WIN32
    WSACleanup();
#endif
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

bool BridgeClient::Start(const std::string& host, int port, const std::string& token) {
    m_Host  = host;
    m_Port  = port;
    m_Token = token;
    m_ShouldRun = true;

    m_ConnectionThread = std::thread(&BridgeClient::ConnectionLoop, this);
    return true;
}

void BridgeClient::Stop() {
    m_ShouldRun = false;
    CleanupSocket();

    if (m_ConnectionThread.joinable()) {
        m_ConnectionThread.join();
    }
    if (m_ReceiveThread.joinable()) {
        m_ReceiveThread.join();
    }
}

bool BridgeClient::IsConnected() const {
    return m_IsConnected.load(std::memory_order_relaxed);
}

double BridgeClient::GetLatencyMs() const {
    return m_LatencyMs.load(std::memory_order_relaxed);
}

void BridgeClient::RegisterCallback(IncomingMessageCallback callback) {
    m_Callback = std::move(callback);
}

void BridgeClient::SetProtocol(const std::string& protocol) {
    m_Protocol = protocol;
}

void BridgeClient::SetReconnectCallback(ReconnectCallback cb) {
    m_ReconnectCallback = std::move(cb);
}

// ─────────────────────────────────────────────────────────────────────────────
// Send — protocol-aware framing
// ─────────────────────────────────────────────────────────────────────────────

bool BridgeClient::Send(const std::string& jsonPayload) {
    if (!m_IsConnected.load(std::memory_order_relaxed) || m_Socket == INVALID_SOCKET) {
        return false;
    }

    // While auth is pending, only let the auth handshake through.
    if (!m_IsAuthenticated.load(std::memory_order_relaxed) && !m_Token.empty()) {
        if (jsonPayload.find("\"event\":\"auth\"") == std::string::npos) {
            return false;
        }
    }

    std::lock_guard<std::mutex> lock(m_SendMutex);

    std::string frameData;

    if (m_Protocol == "ndjson") {
        // Newline-delimited JSON: append '\n' if missing
        frameData = jsonPayload;
        if (frameData.empty() || frameData.back() != '\n') {
            frameData += '\n';
        }
    } else {
        // "length_prefixed_json" or "length_prefixed_msgpack":
        // 4-byte big-endian uint32 length prefix followed by raw payload bytes.
        uint32_t len = static_cast<uint32_t>(jsonPayload.size());
        uint8_t header[4];
        header[0] = static_cast<uint8_t>((len >> 24) & 0xFF);
        header[1] = static_cast<uint8_t>((len >> 16) & 0xFF);
        header[2] = static_cast<uint8_t>((len >>  8) & 0xFF);
        header[3] = static_cast<uint8_t>((len      ) & 0xFF);
        frameData  = std::string(reinterpret_cast<char*>(header), 4);
        frameData += jsonPayload;
    }

    // Retry send() until all bytes are dispatched or an error occurs.
    const char* dataPtr  = frameData.c_str();
    size_t      bytesLeft = frameData.size();

    while (bytesLeft > 0) {
        int sent = send(m_Socket, dataPtr, static_cast<int>(bytesLeft), 0);
        if (sent == SOCKET_ERROR) {
            // Socket error — mark disconnected so ConnectionLoop will retry.
            CleanupSocket();
            return false;
        }
        bytesLeft -= static_cast<size_t>(sent);
        dataPtr   += sent;
    }

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ping / Pong
// ─────────────────────────────────────────────────────────────────────────────

void BridgeClient::SendPing() {
    long long nowMs = NowMs();
    m_LastPingSentTime = std::chrono::steady_clock::now();

    // Build the ping payload.  We deliberately bypass the auth-gate in Send()
    // because pings are internal heartbeats, not user messages.  To do this we
    // temporarily use the raw framing path.  Since Send() already handles
    // framing we just call it directly; ping events are always allowed even
    // before auth — Bun will simply echo them.
    std::string pingJson =
        "{\"event\":\"ping\",\"timestamp_ms\":" + std::to_string(nowMs) + "}";

    // Use the internal locked send path so we don't deadlock.
    // We re-implement framing inline to avoid the auth-gate in Send().
    std::lock_guard<std::mutex> lock(m_SendMutex);

    std::string frameData;
    if (m_Protocol == "ndjson") {
        frameData = pingJson + '\n';
    } else {
        uint32_t len = static_cast<uint32_t>(pingJson.size());
        uint8_t header[4];
        header[0] = static_cast<uint8_t>((len >> 24) & 0xFF);
        header[1] = static_cast<uint8_t>((len >> 16) & 0xFF);
        header[2] = static_cast<uint8_t>((len >>  8) & 0xFF);
        header[3] = static_cast<uint8_t>((len      ) & 0xFF);
        frameData  = std::string(reinterpret_cast<char*>(header), 4);
        frameData += pingJson;
    }

    const char* dataPtr   = frameData.c_str();
    size_t      bytesLeft = frameData.size();
    while (bytesLeft > 0) {
        int sent = send(m_Socket, dataPtr, static_cast<int>(bytesLeft), 0);
        if (sent == SOCKET_ERROR) {
            // Socket error detected inside ping — clean up without deadlock.
            // CleanupSocket() does not take m_SendMutex, so this is safe.
            m_IsConnected.store(false, std::memory_order_relaxed);
            if (m_Socket != INVALID_SOCKET) {
#ifdef _WIN32
                closesocket(m_Socket);
#else
                close(m_Socket);
#endif
                m_Socket = INVALID_SOCKET;
            }
            return;
        }
        bytesLeft -= static_cast<size_t>(sent);
        dataPtr   += sent;
    }
}

void BridgeClient::HandlePong(long long sentTimestampMs) {
    // RTT = current wall-clock ms − the timestamp that was embedded in the ping.
    long long nowMs = NowMs();
    double rtt = static_cast<double>(nowMs - sentTimestampMs);
    if (rtt >= 0.0) {
        m_LatencyMs.store(rtt, std::memory_order_relaxed);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth response handler
// ─────────────────────────────────────────────────────────────────────────────

void BridgeClient::HandleAuthResponse(const std::string& line) {
    // A line may contain either the event name as a key value or as plain text.
    // We look for the canonical substrings to remain resilient to formatting.
    if (line.find("auth_success") != std::string::npos) {
        std::cout << "[MetaBun Bridge] Authentication successful." << std::endl;
        m_IsAuthenticated.store(true, std::memory_order_release);
    } else if (line.find("auth_failed") != std::string::npos) {
        std::cerr << "[MetaBun Bridge] Authentication FAILED. Closing socket." << std::endl;
        CleanupSocket();
    }
    // Any other line is ignored by the auth handler; ReceiveLoop decides
    // whether to forward it based on m_IsAuthenticated.
}

// ─────────────────────────────────────────────────────────────────────────────
// Socket management
// ─────────────────────────────────────────────────────────────────────────────

void BridgeClient::CleanupSocket() {
    m_IsConnected.store(false, std::memory_order_relaxed);
    m_IsAuthenticated.store(false, std::memory_order_relaxed);

    if (m_Socket != INVALID_SOCKET) {
#ifdef _WIN32
        shutdown(m_Socket, SD_BOTH);
        closesocket(m_Socket);
#else
        shutdown(m_Socket, SHUT_RDWR);
        close(m_Socket);
#endif
        m_Socket = INVALID_SOCKET;
    }
}

bool BridgeClient::EstablishConnection() {
    CleanupSocket();

    m_Socket = socket(AF_INET, SOCK_STREAM, 0);
    if (m_Socket == INVALID_SOCKET) {
        std::cerr << "[MetaBun Bridge] socket() failed." << std::endl;
        return false;
    }

    struct sockaddr_in serverAddr;
    std::memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_port   = htons(static_cast<uint16_t>(m_Port));

#ifdef _WIN32
    serverAddr.sin_addr.s_addr = inet_addr(m_Host.c_str());
    if (serverAddr.sin_addr.s_addr == INADDR_NONE) {
        std::cerr << "[MetaBun Bridge] Invalid host address: " << m_Host << std::endl;
        CleanupSocket();
        return false;
    }
#else
    if (inet_pton(AF_INET, m_Host.c_str(), &serverAddr.sin_addr) <= 0) {
        std::cerr << "[MetaBun Bridge] Invalid host address: " << m_Host << std::endl;
        CleanupSocket();
        return false;
    }
#endif

    if (connect(m_Socket,
                reinterpret_cast<struct sockaddr*>(&serverAddr),
                sizeof(serverAddr)) == SOCKET_ERROR)
    {
        CleanupSocket();
        return false;
    }

    m_IsConnected.store(true, std::memory_order_release);

    if (!m_Token.empty()) {
        // Auth handshake — always sent as NDJSON regardless of m_Protocol so
        // that the Bun bridge can parse it without needing to know the protocol
        // in advance.  After auth succeeds the configured protocol is used.
        std::string authPayload =
            "{\"event\":\"auth\",\"token\":\"" + m_Token + "\"}\n";

        std::lock_guard<std::mutex> lock(m_SendMutex);
        const char* dataPtr   = authPayload.c_str();
        size_t      bytesLeft = authPayload.size();
        while (bytesLeft > 0) {
            int sent = send(m_Socket, dataPtr, static_cast<int>(bytesLeft), 0);
            if (sent == SOCKET_ERROR) {
                // Unlock happens via RAII; close socket.
                m_IsConnected.store(false, std::memory_order_relaxed);
                if (m_Socket != INVALID_SOCKET) {
#ifdef _WIN32
                    closesocket(m_Socket);
#else
                    close(m_Socket);
#endif
                    m_Socket = INVALID_SOCKET;
                }
                return false;
            }
            bytesLeft -= static_cast<size_t>(sent);
            dataPtr   += sent;
        }
        // m_IsAuthenticated remains false until HandleAuthResponse() sets it.
    } else {
        // No token required — treat as immediately authenticated.
        m_IsAuthenticated.store(true, std::memory_order_release);
    }

    return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Connection loop (runs in m_ConnectionThread)
// ─────────────────────────────────────────────────────────────────────────────

void BridgeClient::ConnectionLoop() {
    while (m_ShouldRun.load(std::memory_order_relaxed)) {

        if (!m_IsConnected.load(std::memory_order_relaxed)) {
            std::cout << "[MetaBun Bridge] Attempting to connect to Bun runtime at "
                      << m_Host << ":" << m_Port << " ..." << std::endl;

            if (EstablishConnection()) {
                std::cout << "[MetaBun Bridge] TCP connection established." << std::endl;

                // Spawn / respawn the receive thread.
                if (m_ReceiveThread.joinable()) {
                    m_ReceiveThread.join();
                }
                m_ReceiveThread = std::thread(&BridgeClient::ReceiveLoop, this);

                // Wait for authentication to complete before notifying callers.
                // Poll with short sleeps to keep the connection loop responsive.
                while (m_ShouldRun.load(std::memory_order_relaxed)
                       && m_IsConnected.load(std::memory_order_relaxed)
                       && !m_IsAuthenticated.load(std::memory_order_acquire))
                {
                    std::this_thread::sleep_for(std::chrono::milliseconds(50));
                }

                if (m_IsAuthenticated.load(std::memory_order_relaxed)) {
                    std::cout << "[MetaBun Bridge] Session ready." << std::endl;

                    // Notify plugin that the bridge is ready (re-send registrations).
                    if (m_ReconnectCallback) {
                        try {
                            m_ReconnectCallback();
                        } catch (const std::exception& e) {
                            std::cerr << "[MetaBun Bridge] ReconnectCallback threw: "
                                      << e.what() << std::endl;
                        }
                    }

                    // Initialise ping timer.
                    m_LastPingTime = std::chrono::steady_clock::now();
                }

            } else {
                // Connection failed — wait before retrying.
                std::this_thread::sleep_for(std::chrono::seconds(3));
            }

        } else {
            // Already connected — check whether it is time to send a ping.
            auto now     = std::chrono::steady_clock::now();
            auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                               now - m_LastPingTime).count();

            if (m_IsAuthenticated.load(std::memory_order_relaxed)
                && elapsed >= m_PingIntervalMs)
            {
                m_LastPingTime = now;
                SendPing();
            }

            // Sleep 1 second between iterations (granularity for ping scheduling).
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Receive loop (runs in m_ReceiveThread)
// ─────────────────────────────────────────────────────────────────────────────

void BridgeClient::ReceiveLoop() {
    // Large buffer to reduce syscall overhead.
    char        buffer[65536];
    std::string accumulator;
    accumulator.reserve(65536);

    while (m_ShouldRun.load(std::memory_order_relaxed)
           && m_IsConnected.load(std::memory_order_relaxed))
    {
        int bytesReceived = recv(m_Socket,
                                 buffer,
                                 static_cast<int>(sizeof(buffer) - 1),
                                 0);

        if (bytesReceived <= 0) {
            if (m_ShouldRun.load(std::memory_order_relaxed)) {
                std::cout << "[MetaBun Bridge] Connection lost (recv returned "
                          << bytesReceived << ")." << std::endl;
            }
            CleanupSocket();
            break;
        }

        // Null-terminate for safety, then append to the NDJSON accumulator.
        buffer[bytesReceived] = '\0';
        accumulator.append(buffer, static_cast<size_t>(bytesReceived));

        // Dispatch all complete lines.
        size_t newlinePos;
        while ((newlinePos = accumulator.find('\n')) != std::string::npos) {
            std::string line = accumulator.substr(0, newlinePos);
            accumulator.erase(0, newlinePos + 1);

            if (line.empty()) {
                continue; // Skip blank separator lines.
            }

            // Always run the auth handler so it can set m_IsAuthenticated.
            HandleAuthResponse(line);

            if (!m_IsAuthenticated.load(std::memory_order_acquire)) {
                // Not yet authenticated — suppress callback forwarding.
                continue;
            }

            // Forward to plugin callback.
            if (m_Callback) {
                try {
                    m_Callback(line);
                } catch (const std::exception& e) {
                    std::cerr << "[MetaBun Bridge] Callback threw: "
                              << e.what() << std::endl;
                } catch (...) {
                    std::cerr << "[MetaBun Bridge] Callback threw an unknown exception."
                              << std::endl;
                }
            }
        }
    }
}
