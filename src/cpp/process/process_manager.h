#ifndef _INCLUDE_METABUN_PROCESS_MANAGER_H_
#define _INCLUDE_METABUN_PROCESS_MANAGER_H_

#include <string>
#include <vector>
#include <functional>
#include <atomic>
#include <thread>

#ifdef _WIN32
    #include <windows.h>
    typedef HANDLE ProcessHandle;
#else
    #include <unistd.h>
    typedef pid_t ProcessHandle;
    #define INVALID_HANDLE_VALUE (-1)
#endif

/**
 * ProcessManager — Metamod C++ plugin yüklendiğinde Bun runtime process'ini
 * otomatik olarak başlatır (fork/exec). Plugin unload edildiğinde süreci
 * temizce sonlandırır.
 *
 * Bun süreci çalışmadığı sürece yeniden başlatma döngüsü çalışır (watch dog).
 * Bu sayede TypeScript tarafında çöküş yaşansa bile sunucu çalışmaya devam
 * eder ve Bun kısa sürede yeniden ayağa kalkar.
 *
 * Çalışma dizini ve Bun binary yolu çevre değişkenleriyle özelleştirilebilir:
 *   BUN_BINARY     — Bun'un tam yolu (varsayılan: "bun")
 *   META_BUN_DIR   — MetaBun kurulum dizini (varsayılan: plugin'in yanı)
 *   BRIDGE_PORT    — TCP port (varsayılan: 27013)
 *   BRIDGE_PROTOCOL — Protokol seçimi (varsayılan: "ndjson")
 */
class ProcessManager {
public:
    /** Süreç durumu değiştiğinde çağrılan callback. */
    using StatusCallback = std::function<void(bool running, int exitCode)>;

    ProcessManager();
    ~ProcessManager();

    /**
     * Bun sürecini başlat.
     *
     * @param workingDir  MetaBun kök dizini (index.ts'nin bulunduğu yer).
     * @param bunBinary   Bun çalıştırılabilir yolu (PATH'te ise sadece "bun").
     * @param extraArgs   Ek komut satırı argümanları.
     * @param onStatus    Süreç durum değişikliği callback'i.
     * @return true  Süreç başarıyla fork/exec edildi.
     * @return false Başlatma başarısız.
     */
    bool Start(const std::string& workingDir,
               const std::string& bunBinary,
               const std::vector<std::string>& extraArgs,
               StatusCallback onStatus = nullptr);

    /**
     * Bun sürecini durdur ve watchdog thread'ini sonlandır.
     * Gönderilen sinyal: SIGTERM (Linux) / TerminateProcess (Windows).
     */
    void Stop();

    /**
     * Bun sürecinin şu an çalışıp çalışmadığını döndür.
     */
    bool IsRunning() const;

    /**
     * Bun sürecinin PID/HANDLE değerini döndür.
     * Süreç çalışmıyorsa platform'a özgü "geçersiz" değer döner.
     */
    ProcessHandle GetHandle() const;

private:
    /**
     * Süreç izleme thread'i — Bun çöktüğünde otomatik yeniden başlatır.
     * Maksimum yeniden başlatma gecikmesi: 5 saniye.
     */
    void WatchdogLoop();

    /**
     * Platforma özgü süreç başlatma.
     * @return true başarılı.
     */
    bool SpawnProcess();

    /**
     * Platforma özgü süreç sonlandırma.
     */
    void KillProcess();

    /**
     * Sürecin hâlâ çalışıp çalışmadığını sorgula.
     * Çıkış kodu dolaylı olarak m_LastExitCode'a yazılır.
     */
    bool CheckProcessAlive();

    /**
     * Bun'ın kurulu olup olmadığını kontrol eder. Kurulu değilse indirip kurar.
     */
    bool EnsureBunInstalled();

    std::string               m_WorkingDir;
    std::string               m_BunBinary;
    std::vector<std::string>  m_Args;
    StatusCallback            m_OnStatus;

    ProcessHandle             m_ProcessHandle;
    std::atomic<bool>         m_ShouldRun;
    std::atomic<bool>         m_IsRunning;
    int                       m_LastExitCode;

    std::thread               m_WatchdogThread;
};

#endif // _INCLUDE_METABUN_PROCESS_MANAGER_H_
