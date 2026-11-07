#!/bin/zsh
# Build Trash Helper's photo recognition from 回收小里長 (recycle-li) on the develop branch.
#
#   zsh tools/trash_helper_vision/build.sh [git-ref]      (default: origin/develop)
#
# 1. Exports recycle-li/web from <git-ref> into build/recycle-vision/ (read-only copy, never edited in place
#    except for the base-URL patch below).
# 2. npm ci, downloads SigLIP base patch16-224 (q8 ONNX, Apache-2.0) and MediaPipe EfficientDet-Lite0
#    (int8 TFLite, Apache-2.0), copies the onnxruntime / MediaPipe wasm.
# 3. Builds tools/trash_helper_vision/entry.ts as an ES module and copies everything to
#    microservices/trash_helper/vendor/recycle-vision/ (models and wasm are git-ignored; rebuild with this script).
#
# Needs Node.js (work/toolchain/node, or any node ≥ 20 on PATH).
# SPDX-License-Identifier: AGPL-3.0-or-later
set -e
REPO="${0:A:h:h:h}"
REF="${1:-origin/develop}"
NODE_DIR="$REPO/../../work/toolchain/node/bin"
[ -d "$NODE_DIR" ] && export PATH="$NODE_DIR:$PATH"
command -v node >/dev/null || { print "Node.js not found"; exit 1; }

WORK="$REPO/build/recycle-vision"
WEB="$WORK/recycle-li/web"
OUT="$REPO/microservices/trash_helper/vendor/recycle-vision"

git -C "$REPO" fetch origin develop >/dev/null 2>&1 || true
print "recycle-li from $REF ($(git -C "$REPO" rev-parse --short "$REF"))"
rm -rf "$WORK/recycle-li" && mkdir -p "$WORK"
git -C "$REPO" archive "$REF" recycle-li/web | tar -x -C "$WORK"
# Model files are big: keep the previous download if it is there.
[ -d "$WORK/models-cache" ] && cp -R "$WORK/models-cache/." "$WEB/public/models/"

cd "$WEB"
npm ci --no-audit --no-fund >/dev/null

MODEL=Xenova/siglip-base-patch16-224
for f in config.json preprocessor_config.json onnx/vision_model_quantized.onnx; do
  dst="public/models/$MODEL/$f"
  [ -s "$dst" ] || { mkdir -p "${dst:h}"; curl -sfL -o "$dst" "https://huggingface.co/$MODEL/resolve/main/$f"; }
done
det=public/models/mediapipe/efficientdet_lite0.tflite
[ -s "$det" ] || { mkdir -p "${det:h}"; curl -sfL -o "$det" https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite; }
mkdir -p "$WORK/models-cache" && cp -R public/models/. "$WORK/models-cache/"
node scripts/copy-ort.mjs >/dev/null

# The vision code loads models relative to document.baseURI; Trash Helper serves them from vendor/recycle-vision/.
for f in src/vision/clip.ts src/vision/detector.ts; do
  sed -i '' 's/document\.baseURI/(globalThis.__RV_BASE ?? document.baseURI)/g' "$f"
done
cp "$REPO/tools/trash_helper_vision/entry.ts" src/th-entry.ts
cat > vite.th.config.ts <<'EOF'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'import.meta.env.VITE_ALLOW_REMOTE_MODEL': '"false"', 'import.meta.env.VITE_SHOW_UNVERIFIED': '"true"' },
  worker: { format: 'es' },
  build: {
    target: 'es2022', outDir: 'dist-th', emptyOutDir: true, chunkSizeWarningLimit: 4000,
    // Not library mode: library mode inlines the onnxruntime wasm as base64 into the JS (≈ 60 MB per copy).
    assetsInlineLimit: 0, copyPublicDir: false,
    rollupOptions: { input: 'src/th-entry.ts', preserveEntrySignatures: 'exports-only', output: { entryFileNames: 'recycle-vision.js' } },
  },
})
EOF
npx vite build -c vite.th.config.ts >/dev/null

rm -rf "$OUT" && mkdir -p "$OUT/data"
cp -R dist-th/. "$OUT/"
# onnxruntime loads its wasm from ort/ (wasmPaths); the copy Vite emits next to the JS is never used.
rm -f "$OUT"/assets/*.wasm
cp -R public/ort public/mediapipe "$OUT/"
mkdir -p "$OUT/models/$MODEL/onnx" "$OUT/models/mediapipe"
cp public/models/$MODEL/config.json public/models/$MODEL/preprocessor_config.json "$OUT/models/$MODEL/"
cp public/models/$MODEL/onnx/vision_model_quantized.onnx "$OUT/models/$MODEL/onnx/"
cp "$det" "$OUT/models/mediapipe/"
cp public/data/text_embeds.json public/data/class_weights.json public/data/image_protos.json "$OUT/data/"
# Item names / kinds for the mapping onto Trash Helper's rules (tools/trash_helper_vision/map.py).
cp src/data/items.json "$OUT/data/rv_items.json"
# 臺北市環保局資源回收分類方式 (official categories, days) for the result card, as in 回收小里長's CatchView.
cp src/data/categories.json "$OUT/data/rv_categories.json"
git -C "$REPO" rev-parse "$REF" > "$OUT/SOURCE_COMMIT"
python3 "$REPO/tools/trash_helper_vision/rv_icons.py"
print "built → ${OUT#$REPO/} ($(du -sh "$OUT" | cut -f1))"
