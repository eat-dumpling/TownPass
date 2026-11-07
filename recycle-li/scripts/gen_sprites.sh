#!/bin/bash
# 用 Codex CLI 的影像生成做里的插圖（開發時用；App 執行時不呼叫生成式 AI）。
# 用法：scripts/gen_sprites.sh <輸出資料夾> <id>=<主題描述> ...   之後跑 scripts/key_sprites.py 去背
OUT="$1"; shift
STYLE='True isometric 2:1 dimetric game-asset view (camera from the front-right, about 30 degrees above), matching a cozy city-builder. Soft children picture-book illustration style, clean vector-like shapes with subtle painterly shading, warm light from the upper-left, gentle darker outline in the object own color (no black outlines). The object stands on nothing: no ground tile, no base plate, no cast shadow. Centered horizontally, the bottom of the object near the lower 85% line of the frame, filling about 75% of the frame width. Square 1024x1024. Background: perfectly flat solid magenta #FF00FF everywhere (it will be keyed out), no gradient, no vignette, no magenta inside the object. No text, no letters, no logos, no people, no watermark.'
PROMPT="Use your image generation tool. For EACH item below, generate one image and save it as a PNG file in the current directory with exactly the given file name. Do not generate anything else. Style for every image: $STYLE
Items:"
for kv in "$@"; do PROMPT="$PROMPT
- ${kv%%=*}.png : ${kv#*=}"; done
PROMPT="$PROMPT
When finished, list the saved files."
cd "$OUT" && codex exec -m gpt-5.6-sol -c model_reasoning_effort="low" --skip-git-repo-check -s workspace-write -C "$OUT" "$PROMPT" < /dev/null
