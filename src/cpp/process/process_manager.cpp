#include "process_manager.h"
#include <iostream>
#include <sstream>
#include <chrono>
#include <cstring>

#ifndef _WIN32
    #include <sys/wait.h>
    #include <signal.h>
    #include <errno.h>
    #include <fcntl.h>
    #include <dlfcn.h>
#endif

// ─── Ctor / Dtor ─────────────────────────────────────────────────────────────

ProcessManager::ProcessManager()
    : m_ProcessHandle(
#ifdef _WIN32
        INVALID_HANDLE_VALUE
#else
        -1
#endif
      )
    , m_ShouldRun(false)
    , m_IsRunning(false)
    , m_LastExitCode(0)
{}

ProcessManager::~ProcessManager() {
    Stop();
}

// ─── Public ──────────────────────────────────────────────────────────────────

bool ProcessManager::Start(const std::string& workingDir,
                           const std::string& bunBinary,
                           const std::vector<std::string>& extraArgs,
                           StatusCallback onStatus) {
    m_WorkingDir = workingDir;
    m_BunBinary  = bunBinary.empty() ? "bun" : bunBinary;
    m_Args       = extraArgs;
    m_OnStatus   = onStatus;
    m_ShouldRun  = true;

    // Bun'ın kurulu olduğundan emin ol, yoksa indir ve kur
    if (!EnsureBunInstalled()) {
        std::cerr << "[MetaBun ProcessManager] Bun runtime is required but could not be installed." << std::endl;
        return false;
    }

    std::cout << "[MetaBun ProcessManager] Starting Bun runtime: "
              << m_BunBinary << " run --cwd " << m_WorkingDir << " src/ts/index.ts"
              << std::endl;

    // İlk başlatma denemesi
    if (!SpawnProcess()) {
        std::cerr << "[MetaBun ProcessManager] Failed to spawn Bun process." << std::endl;
        return false;
    }

    // Watchdog thread'i başlat
    m_WatchdogThread = std::thread(&ProcessManager::WatchdogLoop, this);
    return true;
}

void ProcessManager::Stop() {
    m_ShouldRun = false;

    if (m_IsRunning) {
        std::cout << "[MetaBun ProcessManager] Terminating Bun process..." << std::endl;
        KillProcess();
    }

    if (m_WatchdogThread.joinable()) {
        m_WatchdogThread.join();
    }
}

bool ProcessManager::IsRunning() const {
    return m_IsRunning;
}

ProcessHandle ProcessManager::GetHandle() const {
    return m_ProcessHandle;
}

// ─── Private ─────────────────────────────────────────────────────────────────

void ProcessManager::WatchdogLoop() {
    // İlk başlatma zaten yapıldı; bu thread süreci izler.
    int restartDelay = 1; // saniye

    while (m_ShouldRun) {
        std::this_thread::sleep_for(std::chrono::seconds(1));

        if (!m_ShouldRun) break;

        if (!CheckProcessAlive()) {
            m_IsRunning = false;

            if (m_OnStatus) {
                m_OnStatus(false, m_LastExitCode);
            }

            if (!m_ShouldRun) break;

            std::cout << "[MetaBun ProcessManager] Bun process exited (code="
                      << m_LastExitCode << "). Restarting in "
                      << restartDelay << "s..." << std::endl;

            std::this_thread::sleep_for(std::chrono::seconds(restartDelay));

            // Üstel geri çekilme, maksimum 5 saniye
            restartDelay = std::min(restartDelay * 2, 5);

            if (m_ShouldRun && SpawnProcess()) {
                std::cout << "[MetaBun ProcessManager] Bun process restarted." << std::endl;
                restartDelay = 1; // Başarılı yeniden başlatmada sıfırla

                if (m_OnStatus) {
                    m_OnStatus(true, 0);
                }
            }
        } else {
            // Çalışıyor — delay'i sıfırla
            restartDelay = 1;
        }
    }

    std::cout << "[MetaBun ProcessManager] Watchdog loop ended." << std::endl;
}

bool ProcessManager::SpawnProcess() {
#ifdef _WIN32
    // ── Windows: CreateProcess ───────────────────────────────────────────────
    // Komut satırı oluştur: bun run --cwd <workingDir> src/ts/index.ts [extraArgs...]
    std::string entryPoint = "index.js";
    if (GetFileAttributesA((m_WorkingDir + "\\" + entryPoint).c_str()) == INVALID_FILE_ATTRIBUTES) {
        entryPoint = "src/ts/index.ts";
    }
    std::string cmdLine    = "\"" + m_BunBinary + "\" run --cwd \"" + m_WorkingDir + "\" \"" + entryPoint + "\"";
    for (const auto& arg : m_Args) {
        cmdLine += " " + arg;
    }

    STARTUPINFOA si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof(si));
    si.cb = sizeof(si);
    ZeroMemory(&pi, sizeof(pi));

    // Çalışma dizini
    BOOL success = CreateProcessA(
        nullptr,
        const_cast<char*>(cmdLine.c_str()),
        nullptr,                // process security attrs
        nullptr,                // thread security attrs
        FALSE,                  // inherit handles
        CREATE_NEW_PROCESS_GROUP,
        nullptr,                // inherit environment
        m_WorkingDir.c_str(),  // working directory
        &si,
        &pi
    );

    if (!success) {
        DWORD err = GetLastError();
        std::cerr << "[MetaBun ProcessManager] CreateProcess failed, error=" << err << std::endl;
        return false;
    }

    // Thread handle'ına ihtiyaç yok
    CloseHandle(pi.hThread);
    m_ProcessHandle = pi.hProcess;
    m_IsRunning     = true;
    return true;

#else
    // ── Linux/macOS: fork + execvp ───────────────────────────────────────────
    std::string entryPoint = "index.js";
    if (access((m_WorkingDir + "/" + entryPoint).c_str(), F_OK) != 0) {
        entryPoint = "src/ts/index.ts";
    }


    // execvp için argv dizisi hazırla
    // [0] = bun binary, [1] = "run", [2] = "--cwd", [3] = workingDir, [4] = entry.ts, [...] = extra args, sonunda nullptr
    std::vector<std::string> argStrings;
    argStrings.push_back(m_BunBinary);
    argStrings.push_back("run");
    argStrings.push_back("--cwd");
    argStrings.push_back(m_WorkingDir);
    argStrings.push_back(entryPoint);
    for (const auto& a : m_Args) {
        argStrings.push_back(a);
    }

    std::vector<char*> argv;
    argv.reserve(argStrings.size() + 1);
    for (auto& s : argStrings) {
        argv.push_back(const_cast<char*>(s.c_str()));
    }
    argv.push_back(nullptr);

    pid_t pid = fork();
    if (pid < 0) {
        std::cerr << "[MetaBun ProcessManager] fork() failed: "
                  << strerror(errno) << std::endl;
        return false;
    }

    if (pid == 0) {
        // ── Çocuk süreç ──────────────────────────────────────────────────────
        // Çalışma dizinini değiştir
        if (chdir(m_WorkingDir.c_str()) != 0) {
            std::cerr << "[Child] chdir failed: " << strerror(errno) << std::endl;
            _exit(1);
        }

        // execvp — bu noktadan sonra çocuk process Bun olur
        execvp(m_BunBinary.c_str(), argv.data());

        // execvp başarısız olursa buraya gelir
        std::cerr << "[Child] execvp failed: " << strerror(errno) << std::endl;
        _exit(127);
    }

    // ── Ebeveyn süreç ────────────────────────────────────────────────────────
    m_ProcessHandle = pid;
    m_IsRunning     = true;
    std::cout << "[MetaBun ProcessManager] Bun process spawned (PID=" << pid << ")" << std::endl;
    return true;
#endif
}

void ProcessManager::KillProcess() {
#ifdef _WIN32
    if (m_ProcessHandle != INVALID_HANDLE_VALUE) {
        TerminateProcess(m_ProcessHandle, 0);
        WaitForSingleObject(m_ProcessHandle, 3000);
        CloseHandle(m_ProcessHandle);
        m_ProcessHandle = INVALID_HANDLE_VALUE;
    }
#else
    if (m_ProcessHandle > 0) {
        // Önce SIGTERM ile nazikçe bitir
        kill(m_ProcessHandle, SIGTERM);

        // 3 saniye bekle
        std::this_thread::sleep_for(std::chrono::seconds(3));

        // Hâlâ çalışıyorsa SIGKILL
        if (CheckProcessAlive()) {
            kill(m_ProcessHandle, SIGKILL);
            waitpid(m_ProcessHandle, nullptr, 0);
        }

        m_ProcessHandle = -1;
    }
#endif
    m_IsRunning = false;
}

bool ProcessManager::CheckProcessAlive() {
#ifdef _WIN32
    if (m_ProcessHandle == INVALID_HANDLE_VALUE) return false;

    DWORD exitCode = 0;
    if (!GetExitCodeProcess(m_ProcessHandle, &exitCode)) {
        return false;
    }

    if (exitCode == STILL_ACTIVE) {
        return true;
    }

    // Süreç çıktı
    m_LastExitCode = static_cast<int>(exitCode);
    CloseHandle(m_ProcessHandle);
    m_ProcessHandle = INVALID_HANDLE_VALUE;
    return false;

#else
    if (m_ProcessHandle <= 0) return false;

    int status = 0;
    // WNOHANG: bloklamadan kontrol et
    pid_t result = waitpid(m_ProcessHandle, &status, WNOHANG);

    if (result == 0) {
        // Süreç hâlâ çalışıyor
        return true;
    }

    if (result == m_ProcessHandle) {
        // Süreç çıktı
        if (WIFEXITED(status)) {
            m_LastExitCode = WEXITSTATUS(status);
        } else if (WIFSIGNALED(status)) {
            m_LastExitCode = -(WTERMSIG(status));
        }
        m_ProcessHandle = -1;
        return false;
    }

    // waitpid hatası (ECHILD vb.) — sürecin kaybolduğu anlamına gelir
    m_ProcessHandle = -1;
    return false;
#endif
}

#ifndef _WIN32
static void dummy_function_for_dladdr() {}

static void InstallUnzip() {
    std::cout << "[MetaBun ProcessManager] unzip not found. Attempting to install unzip..." << std::endl;
    if (system("which apt-get >/dev/null 2>&1") == 0) {
        std::cout << "[MetaBun ProcessManager] Using apt-get to install unzip..." << std::endl;
        system("apt-get update && apt-get install -y unzip");
    }
    else if (system("which yum >/dev/null 2>&1") == 0) {
        std::cout << "[MetaBun ProcessManager] Using yum to install unzip..." << std::endl;
        system("yum install -y unzip");
    }
    else if (system("which apk >/dev/null 2>&1") == 0) {
        std::cout << "[MetaBun ProcessManager] Using apk to install unzip..." << std::endl;
        system("apk add unzip");
    }
}
#endif

bool ProcessManager::EnsureBunInstalled() {
#ifdef _WIN32
    return true; // Windows'ta otomatik kuruluma gerek yok
#else
    // 1. Check if bun is bundled next to this shared library (.so)
    Dl_info info;
    if (dladdr((void*)dummy_function_for_dladdr, &info) != 0 && info.dli_fname) {
        std::string pluginLibPath = info.dli_fname;
        size_t lastSlash = pluginLibPath.find_last_of('/');
        if (lastSlash != std::string::npos) {
            std::string bundledBunPath = pluginLibPath.substr(0, lastSlash + 1) + "bun";
            if (access(bundledBunPath.c_str(), F_OK) == 0) {
                m_BunBinary = bundledBunPath;
                // Update working dir if it was set to "."
                if (m_WorkingDir == ".") {
                    size_t binSlash = pluginLibPath.substr(0, lastSlash).find_last_of('/');
                    if (binSlash != std::string::npos) {
                        m_WorkingDir = pluginLibPath.substr(0, binSlash);
                    }
                }
                std::cout << "[MetaBun ProcessManager] Found bundled Bun at: " << m_BunBinary 
                          << " with working directory: " << m_WorkingDir << std::endl;
                return true;
            }
        }
    }

    // 2. Check if bun is bundled in addons/meta-bun/bin/bun (alternative relative checks)
    std::string bundledBun = "addons/meta-bun/bin/bun";
    if (access(bundledBun.c_str(), F_OK) == 0) {
        m_BunBinary = bundledBun;
        return true;
    }
    std::string bundledBunWd = m_WorkingDir + "/bin/bun";
    if (access(bundledBunWd.c_str(), F_OK) == 0) {
        m_BunBinary = bundledBunWd;
        return true;
    }

    // 3. Sistemde bun yüklü mü kontrol et (which bun)
    if (system("which bun >/dev/null 2>&1") == 0) {
        return true;
    }

    // 4. ~/.bun/bin/bun mevcut mu kontrol et
    const char* homeDir = std::getenv("HOME");
    if (homeDir) {
        std::string homeBun = std::string(homeDir) + "/.bun/bin/bun";
        if (access(homeBun.c_str(), F_OK) == 0) {
            m_BunBinary = homeBun;
            return true;
        }
    }

    // 5. bun yüklü değilse, unzip kurulu mu kontrol et ve kur
    if (system("which unzip >/dev/null 2>&1") != 0) {
        InstallUnzip();
    }

    // 6. İndir ve kur
    std::cout << "[MetaBun ProcessManager] Bun runtime not found. Installing via curl..." << std::endl;
    int ret = system("curl -fsSL https://bun.sh/install | bash");
    if (ret != 0) {
        std::cerr << "[MetaBun ProcessManager] Failed to run Bun installation script." << std::endl;
        return false;
    }

    // 7. Kurulum sonrası ~/.bun/bin/bun kontrolü yap
    if (homeDir) {
        std::string homeBun = std::string(homeDir) + "/.bun/bin/bun";
        if (access(homeBun.c_str(), F_OK) == 0) {
            std::cout << "[MetaBun ProcessManager] Bun installed successfully at: " << homeBun << std::endl;
            m_BunBinary = homeBun;
            return true;
        }
    }

    std::cerr << "[MetaBun ProcessManager] Bun was not found in ~/.bun/bin/bun after installation." << std::endl;
    return false;
#endif
}
