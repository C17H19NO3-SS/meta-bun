cmake_minimum_required(VERSION 3.16)
project(metabun_plugin CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ── Çıktı dizini ──────────────────────────────────────────────────────────────
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY
    ${CMAKE_BINARY_DIR}/package/addons/meta-bun/bin)

# ── SDK Yolları (cmake -DHL2SDK_PATH=... ile geçersiz kılınabilir) ────────────
set(HL2SDK_PATH   "" CACHE PATH "Path to HL2SDK (CS2 / Source SDK)")
set(METAMOD_PATH  "" CACHE PATH "Path to Metamod:Source SDK")

if(NOT HL2SDK_PATH OR NOT METAMOD_PATH)
    message(WARNING
        "HL2SDK_PATH ve METAMOD_PATH ayarlanmadı. "
        "Mock mod ile derleniyor (COMPILE_WITH_SOURCE_SDK tanımsız). "
        "Gerçek sunucu için cmake -DHL2SDK_PATH=<path> -DMETAMOD_PATH=<path> kullanın.")
    set(COMPILE_WITH_SDK FALSE)
else()
    set(COMPILE_WITH_SDK TRUE)
endif()

# ── Derleyici Bayrakları ──────────────────────────────────────────────────────
if(MSVC)
    add_compile_options(
        /W4
        /WX
        /EHsc
        /D_CRT_SECURE_NO_WARNINGS
        /D_WINSOCK_DEPRECATED_NO_WARNINGS
    )
else()
    add_compile_options(
        -Wall
        -Wextra
        -fPIC
        -fvisibility=hidden
        -msse2
    )
endif()

# ── Include Dizinleri ─────────────────────────────────────────────────────────
set(INCLUDE_DIRS
    ${CMAKE_CURRENT_SOURCE_DIR}
)

if(COMPILE_WITH_SDK)
    list(APPEND INCLUDE_DIRS
        ${HL2SDK_PATH}/public
        ${HL2SDK_PATH}/public/tier0
        ${HL2SDK_PATH}/public/tier1
        ${HL2SDK_PATH}/public/mathlib
        ${METAMOD_PATH}/core
        ${METAMOD_PATH}/core/sourcehook
        ${CMAKE_CURRENT_SOURCE_DIR}/generated
    )
endif()

include_directories(${INCLUDE_DIRS})

# ── Kaynak Dosyaları ──────────────────────────────────────────────────────────
set(SOURCES
    # Core
    core/metabun_plugin.cpp

    # Network — C++ → Bun TCP köprüsü
    network/bridge_client.cpp
    network/rcon_client.cpp

    # Events — dinamik event hook yönetimi
    events/event_manager.cpp

    # Players — periyodik PlayerStatsUpdate gönderimi
    players/player_stats.cpp

    # Process — Bun runtime fork/exec ve watchdog
    process/process_manager.cpp

    # Menus — interaktif menü işleyici
    menus/menu_handler.cpp

    # ConVars — sunucu convar yönetimi
    convars/convar_manager.cpp

    # SDK Hooks — OnTakeDamage vb. SDK hook'ları
    hooks/sdk_hooks.cpp
)

if(COMPILE_WITH_SDK)
    file(GLOB PROTO_SOURCES "${CMAKE_CURRENT_SOURCE_DIR}/generated/*.pb.cc")
    list(APPEND SOURCES ${PROTO_SOURCES})
    list(APPEND SOURCES "${HL2SDK_PATH}/tier1/convar.cpp")
endif()

set(HEADERS
    # Core
    core/metabun_plugin.h
    core/sdk_mock.h

    # Network
    network/bridge_client.h
    network/rcon_client.h

    # Events
    events/event_manager.h

    # Players
    players/player_stats.h

    # Process
    process/process_manager.h

    # Menus
    menus/menu_handler.h

    # ConVars
    convars/convar_manager.h

    # SDK Hooks
    hooks/sdk_hooks.h

    # Utils
    utils/json_helper.h
)

# ── Build Hedefi ──────────────────────────────────────────────────────────────
add_library(metabun_plugin SHARED ${SOURCES} ${HEADERS})

# ── Hedef Tanımları ──────────────────────────────────────────────────────────
target_compile_definitions(metabun_plugin PRIVATE
    SMM_BUILD
    ORANGEBOX_BUILD
    # Platform
    $<$<PLATFORM_ID:Windows>:WIN32;_WINDOWS>
    $<$<PLATFORM_ID:Linux>:POSIX;_LINUX;COMPILER_GCC;LINUX;stricmp=strcasecmp;strnicmp=strncasecmp>
)

if(COMPILE_WITH_SDK)
    target_compile_definitions(metabun_plugin PRIVATE COMPILE_WITH_SOURCE_SDK META_IS_SOURCE2)
endif()

# ── Bağlantı Kütüphaneleri ────────────────────────────────────────────────────
if(WIN32)
    target_link_libraries(metabun_plugin PRIVATE ws2_32)
endif()

if(COMPILE_WITH_SDK)
    find_package(Protobuf REQUIRED)
    target_link_libraries(metabun_plugin PRIVATE ${PROTOBUF_LIBRARIES})
endif()

if(UNIX AND NOT APPLE)
    target_link_libraries(metabun_plugin PRIVATE dl)
endif()

# ── RPATH settings for Linux to find bundled libraries in the same folder ────
if(UNIX AND NOT APPLE)
    set_target_properties(metabun_plugin PROPERTIES
        BUILD_WITH_INSTALL_RPATH TRUE
        INSTALL_RPATH "$ORIGIN"
    )
endif()

# ── Kurulum (isteğe bağlı) ───────────────────────────────────────────────────
install(TARGETS metabun_plugin
    LIBRARY DESTINATION addons/meta-bun/bin
    RUNTIME DESTINATION addons/meta-bun/bin
)
