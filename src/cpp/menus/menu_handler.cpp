#include "menu_handler.h"
#include "../network/bridge_client.h"
#include "../utils/json_helper.h"
#include "../utils/color_utils.h"
#include <iostream>
#include <nlohmann/json.hpp>

using njson = nlohmann::json;

MenuHandler::MenuHandler() : m_pBridge(nullptr), m_pEngineServer(nullptr) {}
MenuHandler::~MenuHandler() { CloseAllMenus(); }

void MenuHandler::Initialize(BridgeClient* bridge, IVEngineServer* engine) {
    m_pBridge = bridge; m_pEngineServer = engine;
}

void MenuHandler::ShowMenuExtended(int client, const std::string& id, const std::string& title, const std::string& sub, const std::string& foot, int type, const std::vector<MenuItem>& items) {
    if (client < 0) return;
    CloseMenu(client);
    Menu m; m.id = id; m.title = title; m.subTitle = sub; m.footer = foot; m.type = type; m.items = items;
    m_ActiveMenus[client] = m;

    if (client == 0) {
        std::cout << ColorUtils::FormatConsole("\n{Gold}>>> SERVER CONSOLE MENU: " + title + " <<<{Default}") << std::endl;
        if (!sub.empty()) std::cout << "    " << sub << std::endl;
        std::cout << "    ------------------------------------" << std::endl;
        for (size_t i = 0; i < items.size(); ++i) {
            if (items[i].info != "__none__") std::cout << ColorUtils::FormatConsole("    {Green}" + std::to_string(i+1) + ".{White} " + items[i].display) << std::endl;
        }
        std::cout << "    ------------------------------------" << std::endl;
        if (!foot.empty()) std::cout << "    (" << foot << ")" << std::endl;
        std::cout << ColorUtils::FormatConsole("    {Red}0. Exit{Default}") << std::endl;
    } else {
        DisplayMenuToClient(client, m);
    }
}

void MenuHandler::ShowMenu(int client, const std::string& id, const std::string& title, const std::vector<MenuItem>& items) {
    ShowMenuExtended(client, id, title, "", "", 0, items);
}

void MenuHandler::OnMenuSelect(int client, int selection) {
    auto it = m_ActiveMenus.find(client); if (it == m_ActiveMenus.end()) return;
    const Menu& m = it->second;
    if (selection == -1 || (selection >= 0 && static_cast<size_t>(selection) < m.items.size() && m.items[selection].info == "__exit__")) {
        CloseMenu(client); return;
    }
    if (selection < 0 || static_cast<size_t>(selection) >= m.items.size() || m.items[selection].info == "__none__") return;
    const MenuItem& sel = m.items[static_cast<size_t>(selection)];
    SendMenuSelect(client, m.id, sel.info);
    if (sel.info != "__back__" && sel.info != "__next__") CloseMenu(client);
}

void MenuHandler::CloseMenu(int client) { m_ActiveMenus.erase(client); }
void MenuHandler::CloseAllMenus() { m_ActiveMenus.clear(); }
bool MenuHandler::HasActiveMenu(int client) const { return m_ActiveMenus.count(client) > 0; }
const MenuHandler::Menu* MenuHandler::GetActiveMenu(int client) const {
    auto it = m_ActiveMenus.find(client); return (it != m_ActiveMenus.end()) ? &(it->second) : nullptr;
}

void MenuHandler::DisplayMenuToClient(int client, const Menu& m) {
    if (!m_pEngineServer) return;
    
    // Header
    m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors(m.title) + "\n").c_str());
    if (!m.subTitle.empty()) m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors(m.subTitle) + "\n").c_str());
    
    m_pEngineServer->ClientCommand(client - 1, "say \x01\x08━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Items
    for (size_t i = 0; i < m.items.size(); ++i) {
        if (m.items[i].info == "__none__") continue;
        
        std::string d = m.items[i].display;
        // Strip leading number if present
        size_t dot = d.find(". "); 
        if (dot != std::string::npos && dot < 3) d = d.substr(dot + 2);

        std::string ic = "{Green}";
        if (m.items[i].info == "__back__" || m.items[i].info == "__next__") ic = "{Yellow}";
        else if (m.items[i].info == "__exit__") ic = "{Red}";
        
        m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors(ic + std::to_string(i + 1) + ". {White}" + d) + "\n").c_str());
    }

    // Footer
    if (!m.footer.empty()) {
        m_pEngineServer->ClientCommand(client - 1, ("say " + ColorUtils::FormatColors(m.footer) + "\n").c_str());
    }
}

void MenuHandler::SendMenuSelect(int client, const std::string& menuId, const std::string& info) {
    if (!m_pBridge || !m_pBridge->IsConnected()) return;
    njson j; j["event"] = "MenuSelect"; j["client"] = client; j["menuId"] = menuId; j["info"] = info;
    m_pBridge->Send(j);
}

void MenuHandler::PrintMenuToConsole(int client, const Menu& m) const {
    std::cout << "\n========= " << m.title << " =========" << std::endl;
    for (size_t i = 0; i < m.items.size(); ++i) {
        if (m.items[i].info != "__none__") std::cout << " " << (i + 1) << ". " << m.items[i].display << std::endl;
    }
    std::cout << "=================================" << std::endl;
}
