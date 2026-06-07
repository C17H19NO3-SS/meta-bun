#include "rcon_client.h"

#include <cstring>
#include <iostream>
#include <sstream>

// ---------------------------------------------------------------------------
// Platform uyumluluğu — POSIX / Winsock2
// ---------------------------------------------------------------------------
#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    #pragma comment(lib, "Ws2_32.lib")

    // Winsock read/write sarmalayıcıları POSIX recv/send ile uyumlu hâle getirir.
    static inline int platform_recv(SocketType s, char* buf, int len) {
        return ::recv(s, buf, len, 0);
    }
    static inline int platform_send(SocketType s, const char* buf, int len) {
        return ::send(s, buf, len, 0);
    }
    static inline void platform_close(SocketType s) {
        ::closesocket(s);
    }
#else
    #include <sys/socket.h>
    #include <netinet/in.h>
    #include <arpa/inet.h>
    #include <netdb.h>
    #include <unistd.h>
    #include <fcntl.h>
    #include <errno.h>

    static inline int platform_recv(SocketType s, char* buf, int len) {
        return static_cast<int>(::recv(s, buf, static_cast<size_t>(len), 0));
    }
    static inline int platform_send(SocketType s, const char* buf, int len) {
        return static_cast<int>(::send(s, buf, static_cast<size_t>(len), 0));
    }
    static inline void platform_close(SocketType s) {
        ::close(s);
    }
#endif

// ---------------------------------------------------------------------------
// Constructor / Destructor
// ---------------------------------------------------------------------------

RconClient::RconClient()
    : m_Port(0)
    , m_Socket(INVALID_SOCKET)
    , m_IsConnected(false)
    , m_ShouldRun(false)
{
}

RconClient::~RconClient() {
    Disconnect();
}

// ---------------------------------------------------------------------------
// Public — Connect
// ---------------------------------------------------------------------------

bool RconClient::Connect(const std::string& host, int port, const std::string& password) {
    if (m_IsConnected.load()) {
        // Zaten bağlı; önce mevcut bağlantıyı kapat
        Disconnect();
    }

    m_Host     = host;
    m_Port     = port;
    m_Password = password;

#ifdef _WIN32
    // Windows: Winsock başlat (birden fazla Initialize güvenlidir)
    WSADATA wsaData;
    if (::WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        std::cerr << "[RconClient] WSAStartup başarısız.\n";
        return false;
    }
#endif

    // Adres çözümleme
    struct addrinfo hints{};
    hints.ai_family   = AF_INET;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    const std::string portStr = std::to_string(port);
    struct addrinfo* addrResult = nullptr;
    int gaiErr = ::getaddrinfo(host.c_str(), portStr.c_str(), &hints, &addrResult);
    if (gaiErr != 0 || addrResult == nullptr) {
        std::cerr << "[RconClient] Adres çözümleme hatası: " << gai_strerror(gaiErr) << "\n";
        return false;
    }

    // Socket oluştur
    m_Socket = ::socket(addrResult->ai_family,
                        addrResult->ai_socktype,
                        addrResult->ai_protocol);
    if (m_Socket == INVALID_SOCKET) {
        std::cerr << "[RconClient] Socket oluşturulamadı.\n";
        ::freeaddrinfo(addrResult);
        return false;
    }

    // TCP bağlantısı kur
    int connResult = ::connect(m_Socket, addrResult->ai_addr,
                               static_cast<int>(addrResult->ai_addrlen));
    ::freeaddrinfo(addrResult);

    if (connResult == SOCKET_ERROR) {
        std::cerr << "[RconClient] Bağlantı kurulamadı: " << host << ":" << port << "\n";
        CleanupSocket();
        return false;
    }

    m_IsConnected.store(true);
    m_ShouldRun.store(true);

    // Arka plan dinleme thread'ini başlat
    m_ReceiveThread = std::thread(&RconClient::ReceiveLoop, this);

    std::cout << "[RconClient] Bağlandı: " << host << ":" << port << "\n";
    return true;
}

// ---------------------------------------------------------------------------
// Public — Disconnect
// ---------------------------------------------------------------------------

void RconClient::Disconnect() {
    if (!m_IsConnected.load() && m_Socket == INVALID_SOCKET) {
        return; // Zaten kapalı
    }

    m_ShouldRun.store(false);
    m_IsConnected.store(false);

    // Socket'i kapat; ReceiveLoop'taki recv() EAGAIN/ECONNRESET döner ve çıkar
    CleanupSocket();

    if (m_ReceiveThread.joinable()) {
        m_ReceiveThread.join();
    }

    std::cout << "[RconClient] Bağlantı kesildi.\n";
}

// ---------------------------------------------------------------------------
// Public — SendCommand
// ---------------------------------------------------------------------------

bool RconClient::SendCommand(const std::string& command) {
    if (!m_IsConnected.load()) {
        std::cerr << "[RconClient] SendCommand: bağlantı yok.\n";
        return false;
    }

    // Format: "<password> <command>\n"
    const std::string msg = m_Password + " " + command + "\n";

    std::lock_guard<std::mutex> lock(m_SendMutex);

    int totalSent = 0;
    const int msgLen = static_cast<int>(msg.size());
    const char* data = msg.c_str();

    // Partial-send loop — TCP write'ın tümü gidene dek tekrar dene
    while (totalSent < msgLen) {
        int sent = platform_send(m_Socket, data + totalSent, msgLen - totalSent);
        if (sent == SOCKET_ERROR || sent == 0) {
            std::cerr << "[RconClient] Gönderim hatası; bağlantı koptu.\n";
            m_IsConnected.store(false);
            return false;
        }
        totalSent += sent;
    }

    return true;
}

// ---------------------------------------------------------------------------
// Public — IsConnected
// ---------------------------------------------------------------------------

bool RconClient::IsConnected() const {
    return m_IsConnected.load();
}

// ---------------------------------------------------------------------------
// Public — SetResponseCallback
// ---------------------------------------------------------------------------

void RconClient::SetResponseCallback(ResponseCallback cb) {
    m_ResponseCallback = std::move(cb);
}

// ---------------------------------------------------------------------------
// Private — ReceiveLoop
// ---------------------------------------------------------------------------

/**
 * Ayrı thread içinde çalışır; sunucudan gelen veriyi okur ve
 * newline ('\n') karakterine göre satırlara ayırarak callback'i çağırır.
 *
 * Kısmi alımları doğru işlemek için recv() çıktısı inkremental olarak
 * m_lineBuffer'a eklenir.
 */
void RconClient::ReceiveLoop() {
    char    buf[4096];
    std::string lineBuffer; // Kısmi satır birikimi

    while (m_ShouldRun.load()) {
        int bytesRead = platform_recv(m_Socket, buf, static_cast<int>(sizeof(buf) - 1));

        if (bytesRead <= 0) {
            // 0 → sunucu bağlantıyı kapattı; <0 → hata veya socket kapatıldı
            if (m_ShouldRun.load()) {
                std::cerr << "[RconClient] Bağlantı koptu (recv=" << bytesRead << ").\n";
                m_IsConnected.store(false);
            }
            break;
        }

        buf[bytesRead] = '\0';
        lineBuffer.append(buf, static_cast<size_t>(bytesRead));

        // Satır satır işle
        size_t pos;
        while ((pos = lineBuffer.find('\n')) != std::string::npos) {
            std::string line = lineBuffer.substr(0, pos);
            lineBuffer.erase(0, pos + 1);

            // Satır sonu boşlukları temizle (\r\n uyumluluğu için)
            while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) {
                line.pop_back();
            }

            if (!line.empty() && m_ResponseCallback) {
                m_ResponseCallback(line);
            }
        }
    }

    // Kalan tampon varsa gönder (newline olmadan gelmiş son veri)
    if (!lineBuffer.empty() && m_ResponseCallback) {
        m_ResponseCallback(lineBuffer);
    }
}

// ---------------------------------------------------------------------------
// Private — CleanupSocket
// ---------------------------------------------------------------------------

void RconClient::CleanupSocket() {
    if (m_Socket != INVALID_SOCKET) {
        platform_close(m_Socket);
        m_Socket = INVALID_SOCKET;
    }

#ifdef _WIN32
    ::WSACleanup();
#endif
}
