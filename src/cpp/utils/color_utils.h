#ifndef _INCLUDE_METABUN_COLOR_UTILS_H_
#define _INCLUDE_METABUN_COLOR_UTILS_H_

#include <string>
#include <vector>
#include <unordered_map>
#include <regex>

/**
 * ColorUtils — {red}, {green} gibi etiketleri CS2 hex kodlarına çevirir.
 */
class ColorUtils {
public:
    /**
     * Verilen metindeki tüm renk etiketlerini temizler veya CS2 kodlarına çevirir.
     * @param text İşlenecek metin.
     * @return Renklendirilmiş metin.
     */
    static std::string FormatColors(std::string text) {
        // CS2 Chat Renk Kodları (Gerçek Hex Değerleri)
        static const std::unordered_map<std::string, std::string> kColorMap = {
            {"{Default}",    "\x01"},
            {"{White}",      "\x01"},
            {"{Red}",        "\x02"},
            {"{DarkRed}",    "\x02"},
            {"{Team}",       "\x03"},
            {"{Green}",      "\x04"},
            {"{PaleGreen}",  "\x05"},
            {"{Lime}",       "\x06"},
            {"{LightRed}",   "\x07"},
            {"{Grey}",       "\x08"},
            {"{Yellow}",     "\x09"},
            {"{Gold}",       "\x0A"},
            {"{Silver}",     "\x0A"},
            {"{Blue}",       "\x0B"},
            {"{DarkBlue}",   "\x0C"},
            {"{BlueGrey}",   "\x0D"},
            {"{Magenta}",    "\x0E"},
            {"{OrangeRed}",  "\x0F"},
            {"{Orange}",     "\x10"},
            {"{Cyan}",       "\x10"}
        };

        for (const auto& pair : kColorMap) {
            size_t pos = 0;
            while ((pos = text.find(pair.first, pos)) != std::string::npos) {
                text.replace(pos, pair.first.length(), pair.second);
                pos += pair.second.length();
            }
        }

        return text;
    }

    /**
     * Sunucu konsolu (Linux/Windows terminal) için ANSI renk kodlarına çevirir.
     */
    static std::string FormatConsole(std::string text) {
        static const std::unordered_map<std::string, std::string> kAnsiMap = {
            {"{Default}",    "\x1b[0m"},
            {"{White}",      "\x1b[37m"},
            {"{Red}",        "\x1b[31m"},
            {"{DarkRed}",    "\x1b[31m"},
            {"{Team}",       "\x1b[34m"},
            {"{Green}",      "\x1b[32m"},
            {"{PaleGreen}",  "\x1b[92m"},
            {"{Lime}",       "\x1b[36m"},
            {"{LightRed}",   "\x1b[91m"},
            {"{Grey}",       "\x1b[90m"},
            {"{Yellow}",     "\x1b[93m"},
            {"{Gold}",       "\x1b[33m"},
            {"{Silver}",     "\x1b[37m"},
            {"{Blue}",       "\x1b[34m"},
            {"{DarkBlue}",   "\x1b[34m"},
            {"{BlueGrey}",   "\x1b[94m"},
            {"{Purple}",     "\x1b[35m"},
            {"{Magenta}",    "\x1b[35m"},
            {"{OrangeRed}",  "\x1b[91m"},
            {"{Orange}",     "\x1b[38;5;208m"},
            {"{Cyan}",       "\x1b[36m"}
        };

        for (const auto& pair : kAnsiMap) {
            size_t pos = 0;
            while ((pos = text.find(pair.first, pos)) != std::string::npos) {
                text.replace(pos, pair.first.length(), pair.second);
                pos += pair.second.length();
            }
        }
        
        // Reset color at the end of string
        return text + "\x1b[0m";
    }

    /**
     * Tüm renk etiketlerini metinden tamamen temizler.
     */
    static std::string StripColors(std::string text) {
        static const std::vector<std::string> kTags = {
            "{Default}", "{White}", "{Red}", "{DarkRed}", "{Team}", "{Green}", 
            "{PaleGreen}", "{Lime}", "{LightRed}", "{Grey}", "{Yellow}", "{Gold}", 
            "{Silver}", "{Blue}", "{DarkBlue}", "{BlueGrey}", "{Purple}", 
            "{Magenta}", "{OrangeRed}", "{Orange}", "{Cyan}"
        };

        for (const auto& tag : kTags) {
            size_t pos = 0;
            while ((pos = text.find(tag, pos)) != std::string::npos) {
                text.erase(pos, tag.length());
            }
        }
        return text;
    }
};

#endif // _INCLUDE_METABUN_COLOR_UTILS_H_
