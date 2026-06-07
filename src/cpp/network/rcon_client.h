#ifndef _INCLUDE_METABUN_RCON_CLIENT_H_
#define _INCLUDE_METABUN_RCON_CLIENT_H_

#include <string>
#include <atomic>
#include <thread>
#include <functional>
#include <mutex>

#ifdef _WIN32
    #include <winsock2.h>
    typedef SOCKET SocketType;
#else
    typedef int SocketType;
    #define INVALID_SOCKET (-1)
    #define SOCKET_ERROR   (-1)
#endif

/**
 * RconClient — MetaBun RCON sunucusuna bağlanan hafif TCP istemci.
 *
 * Bun tarafı, BRIDGE_PORT + 10 üzerinde bir RCON TCP sunucu açar.
 * Protokol (satır tabanlı, plain text):
 *   İstek:  "<password> <command>\n"
 *   Yanıt:  "[RCON] Command sent to server: <cmd>\n"
 *
 * Bu sınıf C++ plugin'den Bun'a doğrudan komut göndermek için
 * kullanılır (ör. konsol tetikleme, entegrasyon testleri).
 *
 * Çevre değişkeni:
 *   RCON_PASSWORD — Bun RCON şifresi (varsayılan: "meta-bun-rcon")
 *
 * Kullanım:
 * @code
 *   RconClient rcon;
 *   rcon.SetResponseCallback([](const std::string& r){ std::cout << r; });
 *   if (rcon.Connect("127.0.0.1", BRIDGE_PORT + 10, "meta-bun-rcon")) {
 *       rcon.SendCommand("status");
 *   }
 *   rcon.Disconnect();
 * @endcode
 */
class RconClient {
public:
    /// RCON sunucusundan gelen yanıt satırları için callback tipi.
    using ResponseCallback = std::function<void(const std::string& response)>;

    RconClient();
    ~RconClient();

    // Kopyalama ve atama yasak — socket ownership tek taraflı.
    RconClient(const RconClient&)            = delete;
    RconClient& operator=(const RconClient&) = delete;

    /**
     * RCON sunucusuna TCP bağlantısı kur ve dinleme thread'ini başlat.
     *
     * @param host     Bun RCON host adresi (varsayılan: "127.0.0.1").
     * @param port     RCON port numarası (genellikle BRIDGE_PORT + 10).
     * @param password Bun RCON şifresi.
     * @return Bağlantı başarıysa true, aksi hâlde false.
     */
    bool Connect(const std::string& host, int port, const std::string& password);

    /**
     * Bağlantıyı kapat ve arka plan thread'ini sonlandır.
     * Destructor'dan da güvenle çağrılabilir.
     */
    void Disconnect();

    /**
     * Bun RCON sunucusuna bir komut satırı gönder.
     *
     * Gönderilen format: "<password> <command>\n"
     * Thread-safe (iç mutex korumalı).
     *
     * @param command  Gönderilecek komut (örn. "status", "say hello").
     * @return Gönderim başarıysa true; bağlantı yoksa false.
     */
    bool SendCommand(const std::string& command);

    /**
     * Bağlantı durumunu sorgular (thread-safe atomic).
     */
    bool IsConnected() const;

    /**
     * Sunucudan gelen yanıt satırları için callback kaydet.
     * Connect() çağrısından önce ayarlanmalıdır.
     *
     * @param cb  Her yanıt satırında çağrılacak fonksiyon.
     */
    void SetResponseCallback(ResponseCallback cb);

private:
    /// Gelen veriyi newline'a göre ayrıştırıp callback'e iletir.
    void ReceiveLoop();

    /// Platform bağımsız socket kapatma yardımcısı.
    void CleanupSocket();

    // --- Bağlantı bilgileri ---
    std::string m_Host;
    int         m_Port;
    std::string m_Password;

    // --- Socket & thread durumu ---
    SocketType            m_Socket;         ///< Platform-native socket handle
    std::atomic<bool>     m_IsConnected;    ///< Bağlantı aktif mi?
    std::atomic<bool>     m_ShouldRun;      ///< ReceiveLoop'u devam ettir?
    std::thread           m_ReceiveThread;  ///< Gelen veri okuma thread'i
    std::mutex            m_SendMutex;      ///< SendCommand thread-safety

    ResponseCallback      m_ResponseCallback; ///< Yanıt satırı callback'i
};

#endif // _INCLUDE_METABUN_RCON_CLIENT_H_
