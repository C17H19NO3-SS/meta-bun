#!/usr/bin/env bash
# =============================================================================
# MetaBun — C++ Plugin Build Script
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${SCRIPT_DIR}/build"
BUILD_TYPE="Release"
MMSOURCE_PATH=""
HL2SDK_PATH=""

# ── Argüman Ayrıştırma ───────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case $1 in
        --mmsrc)
            MMSOURCE_PATH="$2"; shift 2 ;;
        --sdk)
            HL2SDK_PATH="$2"; shift 2 ;;
        --release)
            BUILD_TYPE="Release"; shift ;;
        --debug)
            BUILD_TYPE="Debug"; shift ;;
        *)
            shift ;;
    esac
done

if [[ -z "$MMSOURCE_PATH" || -z "$HL2SDK_PATH" ]]; then
    echo "HATA: --mmsrc ve --sdk yolları belirtilmelidir."
    exit 1
fi

echo "=============================================="
echo "  MetaBun C++ Plugin Build"
echo "  Tip       : ${BUILD_TYPE}"
echo "  HL2SDK    : ${HL2SDK_PATH}"
echo "  Metamod   : ${MMSOURCE_PATH}"
echo "  Çıktı     : ${BUILD_DIR}"
echo "=============================================="

mkdir -p "${BUILD_DIR}"
cd "${BUILD_DIR}"

cmake .. \
    -DCMAKE_BUILD_TYPE="${BUILD_TYPE}" \
    -DMMSOURCE_PATH="${MMSOURCE_PATH}" \
    -DHL2SDK_PATH="${HL2SDK_PATH}"

make -j$(nproc)

# Dağıtım için paketleme
mkdir -p package/addons/meta-bun/bin
cp metabun_bridge_mm.so package/addons/meta-bun/bin/

echo ""
echo "[Build] ✅ Derleme başarılı!"
ls -lh package/addons/meta-bun/bin/metabun_bridge_mm.so
