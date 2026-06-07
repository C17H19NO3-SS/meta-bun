#!/usr/bin/env bash
# =============================================================================
# MetaBun — C++ Plugin Build Script
# =============================================================================
# Kullanım:
#   ./build.sh                          # Mock mod (SDK olmadan)
#   ./build.sh --sdk /path/to/hl2sdk --mmsrc /path/to/metamod
#   ./build.sh --clean                  # Build dizinini temizle
#   ./build.sh --release                # Release build (varsayılan: Debug)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
BUILD_TYPE="Debug"
HL2SDK_PATH=""
METAMOD_PATH=""
CLEAN=false

# ── Argüman Ayrıştırma ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --sdk)
            HL2SDK_PATH="$2"; shift 2 ;;
        --mmsrc)
            METAMOD_PATH="$2"; shift 2 ;;
        --release)
            BUILD_TYPE="Release"; shift ;;
        --clean)
            CLEAN=true; shift ;;
        *)
            echo "Bilinmeyen argüman: $1"; exit 1 ;;
    esac
done

# ── Temizle ──────────────────────────────────────────────────────────────────
if $CLEAN; then
    echo "[Build] Temizleniyor: ${BUILD_DIR}"
    rm -rf "${BUILD_DIR}"
    echo "[Build] Temizleme tamamlandı."
    exit 0
fi

# ── Araç Kontrolü ────────────────────────────────────────────────────────────
if ! command -v cmake &>/dev/null; then
    echo "[Build] HATA: cmake bulunamadı. Lütfen kurun:"
    echo "         Ubuntu/Debian: sudo apt install cmake"
    echo "         Arch:          sudo pacman -S cmake"
    exit 1
fi

if ! command -v g++ &>/dev/null && ! command -v clang++ &>/dev/null; then
    echo "[Build] HATA: C++ derleyicisi bulunamadı (g++ veya clang++ gerekli)."
    echo "         Ubuntu/Debian: sudo apt install build-essential"
    exit 1
fi

echo "=============================================="
echo "  MetaBun C++ Plugin Build"
echo "  Tip       : ${BUILD_TYPE}"
echo "  HL2SDK    : ${HL2SDK_PATH:-<mock mod>}"
echo "  Metamod   : ${METAMOD_PATH:-<mock mod>}"
echo "  Çıktı     : ${BUILD_DIR}"
echo "=============================================="

# ── CMake Yapılandırma ────────────────────────────────────────────────────────
CMAKE_ARGS=(
    -S "${SCRIPT_DIR}"
    -B "${BUILD_DIR}"
    -DCMAKE_BUILD_TYPE="${BUILD_TYPE}"
)

if [[ -n "$HL2SDK_PATH" ]]; then
    CMAKE_ARGS+=(-DHL2SDK_PATH="${HL2SDK_PATH}")
    
    echo "[Build] Protobuf dosyaları derleniyor..."
    mkdir -p "${SCRIPT_DIR}/generated"
    if ! command -v protoc &>/dev/null; then
        echo "[Build] HATA: protoc bulunamadı. Lütfen protobuf-compiler kurun."
        exit 1
    fi
    protoc -I"${HL2SDK_PATH}/common" --cpp_out="${SCRIPT_DIR}/generated" "${HL2SDK_PATH}"/common/*.proto
    if [[ -d "${HL2SDK_PATH}/networksystem" ]]; then
        protoc -I"${HL2SDK_PATH}/networksystem" --cpp_out="${SCRIPT_DIR}/generated" "${HL2SDK_PATH}"/networksystem/*.proto
    fi
fi

if [[ -n "$METAMOD_PATH" ]]; then
    CMAKE_ARGS+=(-DMETAMOD_PATH="${METAMOD_PATH}")
fi

echo ""
echo "[Build] cmake yapılandırılıyor..."
cmake "${CMAKE_ARGS[@]}"

# ── Derleme ──────────────────────────────────────────────────────────────────
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo ""
echo "[Build] Derleniyor (${NPROC} thread)..."
cmake --build "${BUILD_DIR}" --parallel "${NPROC}"

# ── Çıktı Bilgisi ────────────────────────────────────────────────────────────
SO_PATH="${BUILD_DIR}/package/addons/meta-bun/bin/libmetabun_plugin.so"
DLL_PATH="${BUILD_DIR}/package/addons/meta-bun/bin/metabun_plugin.dll"

echo ""
echo "[Build] ✅ Derleme başarılı!"

if [[ -f "$SO_PATH" ]]; then
    echo "[Build] Plugin: ${SO_PATH}"
    ls -lh "$SO_PATH"
elif [[ -f "$DLL_PATH" ]]; then
    echo "[Build] Plugin: ${DLL_PATH}"
    ls -lh "$DLL_PATH"
fi

echo ""
echo "[Build] Sunucuya kopyalamak için:"
echo "         cp ${SO_PATH:-<plugin_path>} <gameserver>/game/csgo/addons/meta-bun/bin/"
