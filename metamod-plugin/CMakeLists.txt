cmake_minimum_required(VERSION 3.10)
project(metabun-bridge)

# Use C++11
set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/plugin.cpp
    src/plugin.h
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
    src
    ${MMSOURCE_PATH}/core
    ${MMSOURCE_PATH}/core/sourcehook
    ${HL2SDK_PATH}/public
    ${HL2SDK_PATH}/public/engine
    ${HL2SDK_PATH}/public/tier0
    ${HL2SDK_PATH}/public/tier1
)

# Common definitions for Metamod:Source plugins on Linux
target_compile_definitions(${PROJECT_NAME} PRIVATE
    ORANGEBOX
    _LINUX
    POSIX
    COMPILER_GCC
)

# Output naming (metabun_bridge_mm.so)
set_target_properties(${PROJECT_NAME} PROPERTIES
    PREFIX ""
    OUTPUT_NAME "metabun_bridge_mm"
)

# Note: Depending on the game and SDK, you might need to link against
# tier0, vstdlib, or other libraries from the SDK.
# target_link_libraries(${PROJECT_NAME} PRIVATE tier0 vstdlib)
