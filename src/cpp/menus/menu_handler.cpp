#include "menu_handler.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include "../utils/color_utils.h"
#include <iostream>
#include <sstream>

// ─── Ctor / Dtor ─────────────────────────────────────────────────────────────
MenuHandler::MenuHandler()
    : m_pBridge(nullptr), m_pEngineServer(nullptr) {}

MenuHandler::~MenuHandler() {
    CloseAllMenus();
}

// ─── Public ──────────────────────────────────────────────────────────────────

void MenuHandler::Initialize(BridgeClient* bridge, IVEngineServer* engine) {
    m_pBridge = bridge;
    m_pEngineServer = engine;
}

void MenuHandler::ShowMenuExtended(int client,
                                  const std::string& menuId,
                                  const std::string& title,
                                  const std::string& subTitle,
                                  const std::string& footer,
                                  int type,
                                  const std::vector<MenuItem>& items) {
    // client == 0 sunucu konsoludur
    if (client < 0) return;

    CloseMenu(client);

    Menu menu;
    menu.id       = menuId;
    menu.title    = title;
    menu.subTitle = subTitle;
    menu.footer   = footer;
    menu.type     = type;
    menu.items    = items;

    m_ActiveMenus[client] = menu;

    if (client == 0) {
        // SUNUCU KONSOLU İÇİN ÖZEL GÖRÜNÜM
        std::cout << ColorUtils::FormatConsole("\n{Gold}>>> SERVER CONSOLE MENU: " + title + " <<<{Default}") << std::endl;
        if (!subTitle.empty()) std::cout << "    " << subTitle << std::endl;
        std::cout << "    ------------------------------------" << std::endl;
        for (size_t i = 0; i < items.size(); ++i) {
            if (items[i].info == "__none__") continue;
            std::cout << ColorUtils::FormatConsole("    {Green}" + std::to_string(i+1) + ".{White} " + items[i].display) << std::endl;
        }
        std::cout << "    ------------------------------------" << std::endl;
        if (!footer.empty()) std::cout << "    (" << footer << ")" << std::endl;
        std::cout << ColorUtils::FormatConsole("    {Red}0. Exit{Default}") << std::endl;
        std::cout << ColorUtils::FormatConsole("{Yellow}[MetaBun] Type 'm <num>' to select.{Default}\n") << std::endl;
    } else {
        DisplayMenuToClient(client, menu);
    }
}

void MenuHandler::ShowMenu(int client,
                           const std::string& menuId,
                           const std::string& title,
                           const std::vector<MenuItem>& items) {
    ShowMenuExtended(client, menuId, title, "", "", 0, items);
}

void MenuHandler::OnMenuSelect(int client, int selection) {
    auto it = m_ActiveMenus.find(client);
    if (it == m_ActiveMenus.end()) return;

    const Menu& menu = it->second;

    // Hem 0 (Engine default) hem 9 (Bizim layout index 8) hem de __exit__ info'su Exit sayılır
    if (selection == -1 || 
        (selection >= 0 && static_cast<size_t>(selection) < menu.items.size() && 
         (menu.items[selection].info == "__exit__"))) {
        CloseMenu(client);
        return;
    }

    if (selection < 0 || static_cast<size_t>(selection) >= menu.items.size() || menu.items[selection].info == "__none__") {
        return;
    }

    const MenuItem& selected = menu.items[static_cast<size_t>(selection)];
    
    // Bun'a geri bildir
    SendMenuSelect(client, menu.id, selected.info);

    // Eğer iç bir navigasyon değilse menüyü kapat
    if (selected.info != "__back__" && selected.info != "__next__") {
        CloseMenu(client);
    }
}

void MenuHandler::CloseMenu(int client) {
    auto it = m_ActiveMenus.find(client);
    if (it != m_ActiveMenus.end()) {
        m_ActiveMenus.erase(it);
    }
}

void MenuHandler::CloseAllMenus() {
    if (!m_ActiveMenus.empty()) {
        m_ActiveMenus.clear();
    }
}

bool MenuHandler::HasActiveMenu(int client) const {
    return m_ActiveMenus.count(client) > 0;
}

const MenuHandler::Menu* MenuHandler::GetActiveMenu(int client) const {
    auto it = m_ActiveMenus.find(client);
    if (it != m_ActiveMenus.end()) {
        return &(it->second);
    }
    return nullptr;
}

// ─── Private ─────────────────────────────────────────────────────────────────

void MenuHandler::DisplayMenuToClient(int client, const Menu& menu) {
    if (!m_pEngineServer) return;

    // Başlık ve Stil Seçimi
    std::string titleColor = (menu.type == 1) ? "{Red}" : "{Blue}"; 
    std::string rawTitle = titleColor + "[MetaBun] {White}" + menu.title;
    m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors(rawTitle) + "\n").c_str());

    // Altyazı (Subtitle)
    if (!menu.subTitle.empty()) {
        m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors("{Grey}" + menu.subTitle) + "\n").c_str());
    }

    m_pEngineServer->ClientCommand(client - 1, "say \x01\x08------------------\n");

    // Menü İçeriği (1-9 Slotları)
    for (size_t i = 0; i < menu.items.size(); ++i) {
        if (menu.items[i].info == "__none__") continue;

        // Display string içinde zaten numara varsa (örn: "1. Item") onu temizle
        std::string display = menu.items[i].display;
        size_t dotPos = display.find(". ");
        if (dotPos != std::string::npos && dotPos < 3) {
            display = display.substr(dotPos + 2);
        }

        std::ostringstream ss;
        std::string itemColor = "{Green}"; 
        
        if (menu.items[i].info == "__back__" || menu.items[i].info == "__next__") {
            itemColor = "{Lime}"; 
        } else if (menu.items[i].info == "__exit__") {
            itemColor = "{Red}";
        }

        std::string line = itemColor + std::to_string(i + 1) + ". {White}" + display;
        ss << "say " << ColorUtils::FormatColors(line) << "\n";
        m_pEngineServer->ClientCommand(client - 1, ss.str().c_str());
    }

    m_pEngineServer->ClientCommand(client - 1, "say \x01\x08------------------\n");

    // Alt Bilgi (Footer / Sayfalama)
    if (!menu.footer.empty()) {
        m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors("{Grey}" + menu.footer) + "\n").c_str());
    }

    // Konsola da temiz bir çıktı bas
    m_pEngineServer->ClientCommand(client - 1, "echo \"--- MENU OPENED ---\"\n");
}

void MenuHandler::SendMenuSelect(int client,
                                 const std::string& menuId,
                                 const std::string& info) {
    if (!m_pBridge || !m_pBridge->IsConnected()) {
        return;
    }

    std::ostringstream ss;
    ss << "{"
       << "\"event\":\"MenuSelect\","
       << "\"client\":"  << client                        << ","
       << "\"menuId\":\"" << json::EscapeString(menuId)  << "\","
       << "\"info\":\""   << json::EscapeString(info)    << "\""
       << "}\n";

    m_pBridge->Send(ss.str());
}

void MenuHandler::PrintMenuToConsole(int client, const Menu& menu) const {
    (void)client;
    std::cout << std::endl;
    std::cout << "========= " << menu.title << " =========" << std::endl;
    if (!menu.subTitle.empty()) std::cout << "Sub: " << menu.subTitle << std::endl;
    for (size_t i = 0; i < menu.items.size(); ++i) {
        if (menu.items[i].info == "__none__") continue;
        std::cout << " " << (i + 1) << ". " << menu.items[i].display << std::endl;
    }
    if (!menu.footer.empty()) std::cout << "Foot: " << menu.footer << std::endl;
    std::cout << "=================================" << std::endl;
}
