#ifndef _INCLUDE_METABUN_JSON_HELPER_H_
#define _INCLUDE_METABUN_JSON_HELPER_H_

#include <string>
#include <unordered_map>
#include <sstream>
#include <vector>

namespace json_utils {

/**
 * JSON string içindeki özel karakterleri escape eder.
 * Çift tırnak, ters slash, kontrol karakterleri vb. için \\uXXXX encoding kullanır.
 */
inline std::string EscapeString(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        switch (c) {
            case '\\': ss << "\\\\"; break;
            case '"':  ss << "\\\""; break;
            case '/':  ss << "\\/"; break;
            case '\b': ss << "\\b"; break;
            case '\f': ss << "\\f"; break;
            case '\n': ss << "\\n"; break;
            case '\r': ss << "\\r"; break;
            case '\t': ss << "\\t"; break;
            default:
                if (c >= 0 && c < 32) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", c);
                    ss << buf;
                } else {
                    ss << c;
                }
                break;
        }
    }
    return ss.str();
}

/**
 * JSON escape sequence'larını geri çözer.
 * \\n → newline, \\uXXXX → unicode char vb.
 */
inline std::string UnescapeString(const std::string& input) {
    std::string result;
    result.reserve(input.length());
    for (size_t i = 0; i < input.length(); ++i) {
        if (input[i] == '\\' && i + 1 < input.length()) {
            char next = input[i + 1];
            switch (next) {
                case '\\': result += '\\'; ++i; break;
                case '"':  result += '"';  ++i; break;
                case '/':  result += '/';  ++i; break;
                case 'b':  result += '\b'; ++i; break;
                case 'f':  result += '\f'; ++i; break;
                case 'n':  result += '\n'; ++i; break;
                case 'r':  result += '\r'; ++i; break;
                case 't':  result += '\t'; ++i; break;
                case 'u': {
                    if (i + 5 < input.length()) {
                        std::string hexStr = input.substr(i + 2, 4);
                        int code = std::stoi(hexStr, nullptr, 16);
                        result += static_cast<char>(code);
                        i += 5;
                    }
                    break;
                }
                default:   result += next; ++i; break;
            }
        } else {
            result += input[i];
        }
    }
    return result;
}

/**
 * Tek seviyeli (flat) JSON objesini key→value map'e parse eder.
 * İç içe objeler veya array'ler desteklenmez.
 * Örnek: {"event":"PlayerConnect","client":1}
 */
inline std::unordered_map<std::string, std::string> ParseFlatJSON(const std::string& rawJson) {
    std::unordered_map<std::string, std::string> result;
    
    size_t start = rawJson.find('{');
    size_t end = rawJson.rfind('}');
    if (start == std::string::npos || end == std::string::npos || start >= end) {
        return result;
    }
    
    std::string content = rawJson.substr(start + 1, end - start - 1);
    
    bool inString = false;
    std::string currentKey = "";
    std::string currentValue = "";
    bool readingKey = true;
    
    for (size_t i = 0; i < content.length(); ++i) {
        char c = content[i];
        
        if (c == '"' && (i == 0 || content[i - 1] != '\\')) {
            inString = !inString;
            continue;
        }
        
        if (inString) {
            if (readingKey) {
                currentKey += c;
            } else {
                currentValue += c;
            }
        } else {
            if (c == ':') {
                readingKey = false;
            } else if (c == ',' || i == content.length() - 1) {
                if (i == content.length() - 1 && c != ' ' && c != '\t' && c != '\r' && c != '\n' && c != ',') {
                    if (!readingKey) {
                        currentValue += c;
                    }
                }
                if (!currentKey.empty()) {
                    size_t first = currentValue.find_first_not_of(" \t\r\n");
                    size_t last = currentValue.find_last_not_of(" \t\r\n");
                    if (first != std::string::npos && last != std::string::npos) {
                        currentValue = currentValue.substr(first, last - first + 1);
                    }
                    result[currentKey] = UnescapeString(currentValue);
                }
                currentKey = "";
                currentValue = "";
                readingKey = true;
            } else if (c != ' ' && c != '\t' && c != '\r' && c != '\n') {
                if (!readingKey) {
                    currentValue += c;
                }
            }
        }
    }
    
    if (!currentKey.empty()) {
        size_t first = currentValue.find_first_not_of(" \t\r\n");
        size_t last = currentValue.find_last_not_of(" \t\r\n");
        if (first != std::string::npos && last != std::string::npos) {
            currentValue = currentValue.substr(first, last - first + 1);
        }
        result[currentKey] = UnescapeString(currentValue);
    }
    
    return result;
}

// ---------------------------------------------------------------------------
// Menu Item yardımcıları
// ---------------------------------------------------------------------------

/**
 * Menü öğesini temsil eden yapı.
 * display: Kullanıcıya gösterilecek metin.
 * info:    Plugin'e iletilecek ham bilgi/komut.
 */
struct JsonMenuItem {
    std::string display;
    std::string info;
};

/**
 * Menü öğelerini parse eder. İki format desteklenir:
 *
 * 1) JSON array: [{"display":"Kick","info":"kick"},{"display":"Ban","info":"ban"}]
 * 2) Eski pipe/semicolon format: "display1|info1;display2|info2"
 *
 * @param input Ham giriş stringi.
 * @return      Parse edilmiş JsonMenuItem listesi.
 */
inline std::vector<JsonMenuItem> ParseMenuItemsJSON(const std::string& input) {
    std::vector<JsonMenuItem> items;
    if (input.empty()) return items;

    // --- Format 1: JSON array ---
    if (input.front() == '[') {
        size_t pos = 0;
        while (pos < input.size()) {
            size_t objStart = input.find('{', pos);
            if (objStart == std::string::npos) break;
            size_t objEnd = input.find('}', objStart);
            if (objEnd == std::string::npos) break;

            std::string obj = input.substr(objStart, objEnd - objStart + 1);
            auto fields = ParseFlatJSON(obj);

            JsonMenuItem item;
            auto dit = fields.find("display");
            auto iit = fields.find("info");
            if (dit != fields.end()) item.display = dit->second;
            if (iit != fields.end()) item.info    = iit->second;

            if (!item.display.empty() || !item.info.empty()) {
                items.push_back(item);
            }
            pos = objEnd + 1;
        }
        return items;
    }

    // --- Format 2 (fallback): "display1|info1;display2|info2" ---
    std::istringstream stream(input);
    std::string token;
    while (std::getline(stream, token, ';')) {
        size_t sep = token.find('|');
        if (sep != std::string::npos) {
            JsonMenuItem item;
            item.display = token.substr(0, sep);
            item.info    = token.substr(sep + 1);
            items.push_back(item);
        }
    }
    return items;
}

// ---------------------------------------------------------------------------
// Basit tip dönüşüm yardımcıları
// ---------------------------------------------------------------------------

/**
 * UNIX milisaniye timestamp string'ini long long'a çevirir.
 * Parse hatası durumunda 0LL döner.
 *
 * @param s Timestamp string'i (örn. "1717600123456").
 * @return  long long değer; parse hatası olursa 0LL.
 */
inline long long ParseTimestampMs(const std::string& s) {
    try { return std::stoll(s); } catch (...) { return 0LL; }
}

/**
 * JSON/metin boolean değerini C++ bool'a çevirir.
 * "true", "1" veya "yes" ise true; aksi hâlde false döner.
 *
 * @param s Değer stringi.
 * @return  true veya false.
 */
inline bool ParseBool(const std::string& s) {
    return s == "true" || s == "1" || s == "yes";
}

} // namespace json

#endif // _INCLUDE_METABUN_JSON_HELPER_H_
