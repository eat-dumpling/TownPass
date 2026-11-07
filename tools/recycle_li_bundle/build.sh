#!/bin/zsh
# Bundle 回收小里長 (recycle-li/web) into the app, like 丟丟: production build, served from the phone.
#
#   zsh tools/recycle_li_bundle/build.sh
#
# Why: loading recycle-li from the Vite dev server over Wi-Fi sends hundreds of unbundled modules and
# ~140 MB of models with "no-cache" on every launch, so the camera page waits a long time. Bundled, the
# app serves a minified build from 127.0.0.1:8791 (lib/page/trash_helper/trash_local_server.dart).
#
# Output: microservices/recycle_li/ (git-ignored; rebuild with this script). The big shared files are NOT
# copied: models/Xenova/siglip-base-patch16-224, models/mediapipe/efficientdet_lite0.tflite, ort/ and
# mediapipe/ are byte-identical to 丟丟's vendor/recycle-vision copies, and the local server maps them there.
# Needs Node.js (work/toolchain/node-v24.22.2-darwin-arm64 or node on PATH) and npm deps in recycle-li/web.
# SPDX-License-Identifier: AGPL-3.0-or-later
set -e
REPO="${0:A:h:h:h}"
WEB="$REPO/recycle-li/web"
OUT="$REPO/microservices/recycle_li"
SHARED="$REPO/microservices/trash_helper/vendor/recycle-vision"
for d in "$REPO/../../work/toolchain/node-v24.22.2-darwin-arm64/bin" "$REPO/../../work/toolchain/node/bin"; do
  [ -x "$d/node" ] && { export PATH="$d:$PATH"; break; }
done
command -v node >/dev/null || { print "Node.js not found"; exit 1; }
[ -d "$SHARED/ort" ] || { print "Build 丟丟's vision first: zsh tools/trash_helper_vision/build.sh"; exit 1; }

cd "$WEB"
[ -d node_modules ] || npm ci --no-audit --no-fund
node scripts/copy-ort.mjs >/dev/null
node scripts/gen-icons.mjs >/dev/null
TMP="$REPO/build/recycle-li-dist"
rm -rf "$TMP"
# Same item list as the dev server and 丟丟: items.json has no "verified" items yet (104 are "unknown", 3 "conflict"),
# so .env.production's VITE_SHOW_UNVERIFIED=false would leave only 3 answers (蛋殼, 貝殼, 髒保麗龍) for every photo.
# Variables already in the environment override the .env files.
VITE_SHOW_UNVERIFIED=true VITE_ALLOW_REMOTE_MODEL=false node node_modules/vite/bin/vite.js build --outDir "$TMP" --emptyOutDir >/dev/null

# The shared files must really be the same as 丟丟's, or the app would mix versions.
for f in ort mediapipe models/mediapipe/efficientdet_lite0.tflite models/Xenova/siglip-base-patch16-224; do
  diff -rq -x .gitkeep "$TMP/$f" "$SHARED/$f" >/dev/null || { print "differs from 丟丟's copy: $f (rebuild tools/trash_helper_vision)"; exit 1; }
done

rm -rf "$OUT" && mkdir -p "$OUT"
rsync -a --exclude 'ort/' --exclude 'mediapipe/' --exclude 'models/Xenova/siglip-base-patch16-224/' \
  --exclude 'models/Xenova/clip-vit-base-patch32/' --exclude 'models/mediapipe/efficientdet_lite0.tflite' "$TMP/" "$OUT/"
# Vite also emits a hashed copy of the onnxruntime wasm; it is never fetched (the worker sets wasmPaths to ort/).
rm -f "$OUT"/assets/*.wasm
# Keep the asset folders in git (pubspec.yaml lists them) even though their contents are ignored.
for d in "$OUT" "$OUT/assets" "$OUT/data" "$OUT/data/stops"; do mkdir -p "$d"; touch "$d/.gitkeep"; done
# Asset folders Flutter must list (pubspec.yaml lists directories, not recursively).
print "built → ${OUT#$REPO/} ($(du -sh "$OUT" | cut -f1)); asset folders:"
(cd "$REPO" && find "${OUT#$REPO/}" -type f | xargs -n1 dirname | sort -u | sed 's#$#/#; s#^#    - #')
