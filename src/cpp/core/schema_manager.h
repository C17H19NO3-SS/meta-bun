#ifndef _INCLUDE_METABUN_SCHEMA_MANAGER_H_
#define _INCLUDE_METABUN_SCHEMA_MANAGER_H_

#include <string>
#include <unordered_map>
#include <cstdint>

#ifdef COMPILE_WITH_SOURCE_SDK
class ISchemaSystem;
#endif

class SchemaManager {
public:
    void Initialize();
    
    // Dynamically retrieve the memory offset for a class field using CS2 Schema System
    int GetOffset(const std::string& className, const std::string& fieldName);

private:
    std::unordered_map<std::string, std::unordered_map<std::string, int>> m_Cache;
};

extern SchemaManager g_SchemaManager;

// Helper to set/get a field dynamically
template<typename T>
T* GetFieldPtr(void* entity, int offset) {
    if (offset < 0) return nullptr;
    return reinterpret_cast<T*>((char*)entity + offset);
}

#endif // _INCLUDE_METABUN_SCHEMA_MANAGER_H_
