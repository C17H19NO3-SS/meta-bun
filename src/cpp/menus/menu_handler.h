#ifndef _INCLUDE_METABUN_MENU_HANDLER_H_
#define _INCLUDE_METABUN_MENU_HANDLER_H_

#include <string>
#include <vector>
#include <unordered_map>
#include <functional>
#include "core/sdk_mock.h"

class BridgeClient;

/**
 * MenuHandler — Bun tarafından gönderilen interaktif menü aksiyonlarını
 * CS2 motor katmanına iletir ve oyuncu seçimlerini Bun'a geri bildirir.
 */
class MenuHandler {
public:
    /** Menü içindeki tek bir öğe. */
    struct MenuItem {
        std::string display; ///< Ekranda gösterilen yazı
        std::string info;    ///< Seçim callback'ine dönen veri
    };

    /** Tek bir menü. */
    struct Menu {
        std::string            id;
        std::string            title;
        std::string            subTitle; ///< Yeni: Açıklama satırı
        std::string            footer;   ///< Yeni: Alt bilgi (örn: Sayfa 1/3)
        std::vector<MenuItem>  items;
        int                    type = 0; ///< 0: Normal, 1: Onay, 2: Sayfalı
    };

    MenuHandler();
    ~MenuHandler();

    /**
     * Bridge istemcisini ayarla.
     * @param bridge C++ → Bun TCP bağlantısı.
     * @param engine IVEngineServer arayüzü.
     */
    void Initialize(BridgeClient* bridge, IVEngineServer* engine = nullptr);

    /**
     * Bun'dan gelen detaylı menü gösterimi.
     */
    void ShowMenuExtended(int client,
                          const std::string& menuId,
                          const std::string& title,
                          const std::string& subTitle,
                          const std::string& footer,
                          int type,
                          const std::vector<MenuItem>& items);

    /**
     * Eski overload: Basit menü gösterimi.
     */
    void ShowMenu(int client,
                  const std::string& menuId,
                  const std::string& title,
                  const std::vector<MenuItem>& items);

    /**
     * Bir oyuncunun menü seçimini işle ve Bun'a geri bildir.
     *
     * @param client    Seçimi yapan oyuncu.
     * @param selection Seçilen öğe indeksi (0 tabanlı).
     */
    void OnMenuSelect(int client, int selection);

    /**
     * Aktif menüyü kapat ve kaydı temizle.
     * @param client Client index.
     */
    void CloseMenu(int client);

    /**
     * Tüm aktif menüleri kapat.
     */
    void CloseAllMenus();

    /**
     * Client'ın aktif menüsü olup olmadığını döndür.
     */
    bool HasActiveMenu(int client) const;

    /**
     * Client'ın aktif menü referansını döndür.
     */
    const Menu* GetActiveMenu(int client) const;

private:
    /**
     * Menüyü oyuncunun ekranına (chat/HUD) dikey liste olarak basar.
     */
    void DisplayMenuToClient(int client, const Menu& menu);

    /**
     * MenuSelect event JSON'unu üret ve Bridge üzerinden Bun'a gönder.
     */
    void SendMenuSelect(int client, const std::string& menuId, const std::string& info);

    /**
     * Terminale menüyü metin olarak basarak simüle et.
     */
    void PrintMenuToConsole(int client, const Menu& menu) const;

    BridgeClient* m_pBridge;
    IVEngineServer* m_pEngineServer;

    /** Client index → aktif menü eşlemesi. */
    std::unordered_map<int, Menu> m_ActiveMenus;
};

#endif // _INCLUDE_METABUN_MENU_HANDLER_H_
