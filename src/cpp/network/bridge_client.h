#ifndef _INCLUDE_METABUN_BRIDGE_CLIENT_H_
#define _INCLUDE_METABUN_BRIDGE_CLIENT_H_

#include <string>
#include <vector>
#include <functional>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>

#ifdef _WIN32
    #include <winsock2.h>
    typedef SOCKET SocketType;
#else
    typedef int SocketType;
#endif

/**
 * @brief TCP client that connects to the Bun runtime bridge.
 *
 * Supports multiple wire protocols, token-based authentication,
 * periodic ping/pong latency measurement, and automatic reconnection
 * with an optional reconnect callback.
 */
class BridgeClient {
public:
    /** Callback invoked for every fully-received message line from Bun. */
    typedef std::function<void(const std::string&)> IncomingMessageCallback;

    /** Callback invoked each time the bridge successfully reconnects and
     *  authentication completes (or is not required). Useful for re-sending
     *  hook_event registrations after a connection drop. */
    typedef std::function<void()> ReconnectCallback;

    BridgeClient();
    ~BridgeClient();

    /**
     * @brief Start the connection manager and receive loop.
     * @param host  IPv4 address of the Bun bridge (e.g. "127.0.0.1").
     * @param port  TCP port the bridge listens on.
     * @param token Authentication token; pass empty string to skip auth.
     * @return true  Threads launched successfully (does not imply connected).
     */
    bool Start(const std::string& host, int port, const std::string& token);

    /** @brief Gracefully stop all background threads and close the socket. */
    void Stop();

    /**
     * @brief Send a payload using the current framing protocol.
     *
     * Protocol framing:
     *   - "ndjson"                  → {json}\n
     *   - "length_prefixed_json"    → [4-byte BE uint32 length][json bytes]
     *   - "length_prefixed_msgpack" → [4-byte BE uint32 length][json bytes]
     *     (msgpack encoding is identical to JSON at the wire level here;
     *      a real msgpack encoder would need to be applied before calling Send)
     *
     * @param jsonPayload  The JSON string to send (without trailing newline for
     *                     length-prefixed modes).
     * @return false if not connected, socket error, or auth not yet complete
     *         and payload is not the auth handshake.
     */
    bool Send(const std::string& jsonPayload);

    /**
     * @brief Register the callback that receives every inbound message line.
     * @param callback  Invoked from the receive thread; must be thread-safe.
     */
    void RegisterCallback(IncomingMessageCallback callback);

    /**
     * @brief Set the wire protocol. Must be called before Start().
     * @param protocol One of: "ndjson", "length_prefixed_json",
     *                 "length_prefixed_msgpack".
     *                 Defaults to "ndjson" if not set.
     */
    void SetProtocol(const std::string& protocol);

    /**
     * @brief Register a callback invoked on every successful (re)connect.
     *
     * Called from the connection thread after authentication succeeds (or
     * immediately after EstablishConnection if no token is configured).
     * Use this to re-register hook_event subscriptions.
     *
     * @param cb  Zero-argument callable; must be thread-safe.
     */
    void SetReconnectCallback(ReconnectCallback cb);

    /** @return true if the TCP connection is currently established. */
    bool IsConnected() const;

    /**
     * @return Last measured round-trip ping latency in milliseconds.
     *         Returns -1.0 if no measurement has been taken yet.
     */
    double GetLatencyMs() const;

    /**
     * @brief Record a pong response from Bun to compute round-trip latency.
     *
     * Call this from the plugin's incoming-message handler when the received
     * JSON contains {"action":"pong"} (or equivalent).
     *
     * @param sentTimestampMs  The timestamp_ms value that was embedded in the
     *                         matching ping request.
     */
    void HandlePong(long long sentTimestampMs);

private:
    /**
     * @brief Runs in m_ConnectionThread: manages connect / reconnect loop.
     *
     * After a successful connection + authentication, invokes
     * m_ReconnectCallback (if set) and periodically sends ping heartbeats
     * every m_PingIntervalMs milliseconds.
     */
    void ConnectionLoop();

    /**
     * @brief Runs in m_ReceiveThread: accumulates raw bytes into NDJSON lines.
     *
     * Each complete line is first examined by HandleAuthResponse(); if auth has
     * not completed yet, non-auth lines are silently dropped. Once authenticated,
     * lines are forwarded to m_Callback.
     */
    void ReceiveLoop();

    /**
     * @brief Create the TCP socket and perform the TCP handshake.
     *
     * On success, sets m_IsConnected = true and, when a token is configured,
     * sends the auth handshake. When no token is configured, sets
     * m_IsAuthenticated = true directly.
     *
     * @return true on successful TCP connection.
     */
    bool EstablishConnection();

    /** @brief Close the socket and reset m_IsConnected / m_IsAuthenticated. */
    void CleanupSocket();

    /**
     * @brief Emit a ping heartbeat to Bun to measure round-trip latency.
     *
     * Sends: {"event":"ping","timestamp_ms":<now_ms>}\n
     * Records m_LastPingSentTime for RTT calculation in HandlePong().
     */
    void SendPing();

    /**
     * @brief Inspect a received line for auth_success / auth_failed events.
     *
     * On "auth_success": sets m_IsAuthenticated = true.
     * On "auth_failed":  logs and closes the socket.
     *
     * @param line  A single newline-stripped message from the server.
     */
    void HandleAuthResponse(const std::string& line);

    // ── Connection state ─────────────────────────────────────────────────────

    std::string           m_Host;
    int                   m_Port;
    std::string           m_Token;

    /// Wire protocol identifier: "ndjson" | "length_prefixed_json" |
    /// "length_prefixed_msgpack". Defaults to "ndjson".
    std::string           m_Protocol;

    SocketType            m_Socket;
    std::atomic<bool>     m_IsConnected;
    std::atomic<bool>     m_IsAuthenticated; ///< true after auth_success (or no token)
    std::atomic<bool>     m_ShouldRun;

    // ── Threading ────────────────────────────────────────────────────────────

    std::thread           m_ConnectionThread;
    std::thread           m_ReceiveThread;
    std::mutex            m_SendMutex;

    // ── Callbacks ────────────────────────────────────────────────────────────

    IncomingMessageCallback m_Callback;
    ReconnectCallback       m_ReconnectCallback;

    // ── Ping / latency tracking ───────────────────────────────────────────────

    std::atomic<double>                    m_LatencyMs;       ///< Last RTT in ms; -1 if unknown
    std::chrono::steady_clock::time_point  m_LastPingSentTime; ///< Time of last SendPing()
    int                                    m_PingIntervalMs;  ///< Ping cadence (default 5000 ms)

    /// Tracks the wall-clock time of the last ping dispatch inside
    /// ConnectionLoop so that the 1-second idle sleep can be compared against
    /// m_PingIntervalMs without a separate atomic flag.
    std::chrono::steady_clock::time_point  m_LastPingTime;
};

#endif // _INCLUDE_METABUN_BRIDGE_CLIENT_H_
