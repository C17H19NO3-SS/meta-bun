#include "schema_manager.h"
#include <iostream>

#ifdef COMPILE_WITH_SOURCE_SDK
#include "schemasystem/schemasystem.h"
#include "schemasystem/schematypes.h"
extern ISchemaSystem* g_pSchemaSystem;
#endif

SchemaManager g_SchemaManager;

void SchemaManager::Initialize() {
#ifdef COMPILE_WITH_SOURCE_SDK
    if (!g_pSchemaSystem) {
        std::cerr << "[MetaBun Schema] ERROR: g_pSchemaSystem is null! Schema lookups will fail." << std::endl;
        return;
    }
    std::cout << "[MetaBun Schema] Schema System initialized for dynamic offsets." << std::endl;
#else
    std::cout << "[MetaBun Mock] SchemaManager initialized." << std::endl;
#endif
}

int SchemaManager::GetOffset(const std::string& className, const std::string& fieldName) {
    // Check cache first
    if (m_Cache.find(className) != m_Cache.end()) {
        auto& fields = m_Cache[className];
        if (fields.find(fieldName) != fields.end()) {
            return fields[fieldName];
        }
    }

#ifdef COMPILE_WITH_SOURCE_SDK
    if (!g_pSchemaSystem) return -1;
    
    // server.dll contains most gameplay classes (CCSPlayerController, CBaseEntity etc.)
    CSchemaSystemTypeScope* pScope = g_pSchemaSystem->FindTypeScopeForModule("server.dll");
    if (!pScope) return -1;

    SchemaMetaInfoHandle_t<CSchemaClassInfo> classInfoHandle = pScope->FindDeclaredClass(className.c_str());
    CSchemaClassInfo* classInfo = classInfoHandle.m_pObj;
    
    if (!classInfo) {
        // Fallback to client.dll just in case
        pScope = g_pSchemaSystem->FindTypeScopeForModule("client.dll");
        if (pScope) classInfo = pScope->FindDeclaredClass(className.c_str()).m_pObj;
    }

    if (!classInfo) {
        std::cerr << "[MetaBun Schema] Class not found: " << className << std::endl;
        return -1;
    }

    // Search for the field in the class
    for (int i = 0; i < classInfo->m_nFieldCount; ++i) {
        SchemaClassFieldData_t* field = &classInfo->m_pFields[i];
        if (std::string(field->m_pszName) == fieldName) {
            int offset = field->m_nSingleInheritanceOffset;
            m_Cache[className][fieldName] = offset;
            return offset;
        }
    }

    // Recursively check base classes
    if (classInfo->m_nBaseClassCount > 0 && classInfo->m_pBaseClasses) {
        for (int i = 0; i < classInfo->m_nBaseClassCount; ++i) {
            SchemaBaseClassInfoData_t* baseClass = &classInfo->m_pBaseClasses[i];
            if (baseClass && baseClass->m_pClass) {
                int baseOffset = GetOffset(baseClass->m_pClass->m_pszName, fieldName);
                if (baseOffset != -1) {
                    m_Cache[className][fieldName] = baseOffset;
                    return baseOffset;
                }
            }
        }
    }
    
    std::cerr << "[MetaBun Schema] Field not found: " << className << "::" << fieldName << std::endl;
#endif
    return -1;
}
