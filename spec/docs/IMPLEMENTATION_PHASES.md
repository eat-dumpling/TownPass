# Step-by-Step Implementation Plan for Codex

Each phase is an engineering task with actual files, reproducible checks and a status entry. Do not merely create placeholder directories.

## Phase 0 — Inspect & bootstrap

1. Inspect project / toolchain; if root is this spec pack, create `apps/city_ai_demo` with `flutter create --platforms android,ios --org tw.demo.townpass city_ai_demo` from `apps/`. If repo is already TownPass, follow integration doc instead of overwriting.
2. Add packages minimally: `llamadart: 0.17.5` and compatible `llamadart_llama_cpp_flutter: 0.17.3` for Apple GGUF; `http`, `crypto`, `path_provider`, `url_launcher` as needed. Prefer exact compatible versions and commit `pubspec.lock` for app.
3. Verify SDK requirements. If incompatible Flutter, report it and use FVM-compatible setup (official TownPass `.fvmrc` currently lists 3.47.6; confirm at checkout).
4. Create app with `city_ai` feature, `README.md`, privacy copy. `flutter pub get` and compile/test if available.

**Gate:** app starts and shows functional offline-data screen, or exact unavailable toolchain recorded.

## Phase 1 — Pure offline search + traceable citations

1. Implement typed `KnowledgeDocument`, `KnowledgeSnapshot` and schema validator with strong input length/URL limits.
2. Bundle `fixtures/knowledge_demo.json` into Flutter assets. Keep its `is_demo` label conspicuous.
3. Implement deterministic n-gram lexical retriever + threshold + district boosts + synonyms; no embeddings.
4. Build query UI, source cards, insufficient-data view, offline indicator, text scaling and semantics.
5. Tests: parsing, alias matches, punctuation, low-confidence/no-match, source URLs, repeatable sorting and Korean/English mixed input.

**Gate:** with airplane mode, demo query shows demo card and never makes network request; unknown query reports insufficient data.

## Phase 2 — Open-data ingestion & refresh

1. Implement Python CSV importer CLI, help, tests for Chinese/BOM, missing fields, duplicate records and oversized inputs.
2. Make snapshot SHA256 manifest generator and per-schema validator.
3. User-triggered update client with HTTPS+allowlist, full timeout/size/hash/schema check, atomic replace and rollback.
4. Data version/source info display. On failed update retain old snapshot.
5. Tests: tampered JSON, wrong hash, non-HTTPS URLs, malicious redirects, empty docs, bad schema and partial download.

**Gate:** deterministic importer test passes and update failure leaves previous usable data.

## Phase 3 — Local inference & model manager

1. Add `LocalInferenceEngine` port and fake implementation in unit tests. The real adapter wraps current supported llamadart API, streams deltas and disposes correctly.
2. Add model registry provenance fields, license gates, checksum-first install, cancellation, deletion, disk-space / unsupported-device handling.
3. SmolLM2 135M GGUF smoke test may be offered only if hash/revision legally verifiable. Quality-model slot is Gemma 3 1B IT from Google, disabled pending legal distribution.
4. Add opt-in toggle; after successful load, append a bounded set of retrieved source excerpts and ask local model in Traditional Chinese; do not pass system privileges to snippets.
5. Stub no success: if native model cannot be loaded, present retriever results and truthful error message.
6. Tests: no model -> no generation, bad hash -> never load, known output via fake engine, cancellation, sequential requests, dispose lifecycle, prompt injection.

**Gate:** tested offline fake inference; real local GGUF smoke test only marked passed after actual native execution.

## Phase 4 — Cross-platform validation + UX polish

1. `dart format`, `flutter analyze`, `flutter test`, `python3 -m unittest discover -s tools/tests`.
2. On Android arm64 hardware: download approved model; disable Wi-Fi/mobile data; run repeated query, cancel, delete/re-download. Log device make/model, OS, RAM and temperatures if available.
3. On physical iPhone (iOS 16.4+): same, plus app background/foreground/resume and App Store-oriented license/privacy review.
4. Check screen reader, large fonts, permission declarations and denial paths.
5. No unsupported blanket statement like "all Android/iOS phones can run Gemma". Record RAM, file size, inference latency and failures per device in `IMPLEMENTATION_STATUS.md`.

**Gate:** read `docs/ACCEPTANCE_TESTS.md` and attach evidence or mark not run.

## Phase 5 — TownPass integration (separate feature branch)

1. Clone / open `https://github.com/taipei-doit/TownPass` in user's fork, inspect current `lib/`, pubspec, navigation and `.fvmrc`.
2. Follow `docs/TOWNPASS_INTEGRATION.md`, integrating AI feature module rather than overwriting whole app.
3. Resolve GPL-3.0, dependency, platform build, privacy manifest and launcher compatibility.
4. Build and regression-test TownPass existing features as much as possible; do not promise access to private services.

**Gate:** optional integration branch plus reproducible screenshots/build notes; **not** municipal production deployment.

## Work completion report

Codex must create root `IMPLEMENTATION_STATUS.md` with:

```markdown
| Phase | Status (done/partial/blocked) | Files | Exact commands/results | Remaining work |
|---|---|---|---|---|
```

If an action requires human license acceptance, device signing, real CSV download or external account, state the blocker honestly and complete all unblocked code paths.
