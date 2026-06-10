cmake_minimum_required(VERSION 3.10)
project(metabun-bridge)

# Use C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    plugin.cpp
    plugin.h
    ${HL2SDK_PATH}/tier1/convar.cpp
    generated/connectionless_netmessages.pb.cc
    generated/engine_gcmessages.pb.cc
    generated/netmessages.pb.cc
    generated/networkbasetypes.pb.cc
    generated/network_connection.pb.cc
    generated/source2_steam_stats.pb.cc
    generated/valveextensions.pb.cc
)

# Build the plugin as a shared library
add_library(${PROJECT_NAME} SHARED ${SOURCES})

# Metamod:Source and Source SDK paths
# These should be set via environment variables or -D flags during configuration
# Example: cmake -DMMSOURCE_PATH=/path/to/mmsource -DHL2SDK_PATH=/path/to/hl2sdk ..
set(MMSOURCE_PATH "" CACHE PATH "Path to Metamod:Source")
set(HL2SDK_PATH "" CACHE PATH "Path to HL2SDK")

# Include directories
target_include_directories(${PROJECT_NAME} PRIVATE
    .
    generated
    ${HL2SDK_PATH}/thirdparty/protobuf-3.21.8/src
    ${MMSOURCE_PATH}/core
    ${MMSOURCE_PATH}/core/sourcehook
    ${HL2SDK_PATH}/public
    ${HL2SDK_PATH}/public/engine
    ${HL2SDK_PATH}/public/mathlib
    ${HL2SDK_PATH}/public/interfaces
    ${HL2SDK_PATH}/public/entity2
    ${HL2SDK_PATH}/public/tier0
    ${HL2SDK_PATH}/public/tier1
)

# Common definitions for Metamod:Source plugins on Linux
target_compile_definitions(${PROJECT_NAME} PRIVATE
    ORANGEBOX
    _LINUX
    LINUX
    POSIX
    COMPILER_GCC
    META_IS_SOURCE2
    _GLIBCXX_USE_CXX11_ABI=0
    # CS2 / Source2 specific definitions
    INTERFACEVERSION_VENGINESERVER="Source2EngineToServer001"
    INTERFACEVERSION_SERVERGAMECLIENTS="Source2GameClients001"
    stricmp=strcasecmp
)

# Output naming (metabun_bridge_mm.so)
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    OUTPUT_NAME "metabun_bridge_mm"
)

# Link libraries
target_link_libraries(${PROJECT_NAME} PRIVATE
    ${HL2SDK_PATH}/lib/linux64/release/libprotobuf.a
    ${HL2SDK_PATH}/lib/linux64/tier1.a
    ${HL2SDK_PATH}/lib/linux64/interfaces.a
    ${HL2SDK_PATH}/lib/linux64/mathlib.a
    ${HL2SDK_PATH}/lib/linux64/libtier0.so
)
