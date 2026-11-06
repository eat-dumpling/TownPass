# Codex Master Task — Build TownPass On-Device AI MVP

**You are the implementing engineer. Generate the actual Flutter project now.** Do not answer with a proposed schedule. Read AGENTS.md and all docs, then execute phases until the MVP Definition of Done is met or a concrete environmental blocker prevents a specific step.

## Objective

Build `apps/city_ai_demo` (Android + iOS) as a mobile-first proof-of-concept for a future "台北通本地端 AI 市政助理". It supports offline search over downloaded Taipei municipal content and optional **true on-device** LLM responses grounded by RAG; ALL AI models must be non-Chinese-origin. Build a modular feature for eventual integration into official TownPass Flutter repository, without depending on city authentication/backend/production APIs.

## Required outcomes (P0)

A. Working Flutter UI: user can type a Traditional Chinese question, trigger search and see relevant result cards with source title + link + date; works in airplane mode after initial assets are present. Loading, no-result, download, low-memory and failure states are distinct. The UI never claims it is the official City of Taipei service.

B. Offline RAG: embedded JSON fixtures and an approved typed schema; search by Chinese unigram/bigram + BM25-like or deterministic token scoring; topK=3–5; source-grounded answer mode. If no model, present extractive source summaries (not a fake LLM response). No hallucinated source URLs.

C. On-device LLM abstraction: `LocalInferenceEngine` interface; `LlamadartInferenceEngine` implementation using the API of version `llamadart 0.17.5` OR exact compatible version verified locally. Load GGUF from private app storage; streaming deltas; cancellation; dispose; typed errors; no remote inference endpoints. Use a 135M SmolLM2 Instruct GGUF only as the non-Chinese smoke-test candidate, not the quality benchmark; target Gemma 3 1B **IT** QAT Q4_0 official Google GGUF with license gate.

D. Model manager: model manifest/provenance, declared file size + sha256 from trusted release manifest, HTTPS, allowlisted host, download progress, cancel/retry, disk-space check, hash validation BEFORE loading, atomic file rename, local delete, user consent. No loading model from arbitrary unverified remote URL. Keep Gemma option disabled and explain model access when license/distribution is not configured.

E. Open-data updater: separate online activity only; downloadable JSON + signed or trusted release manifest over HTTPS, SHA-256, exact schema version, max file size, atomic replacement and rollback; no query text or personal data in requests. Keep old snapshot and bundled seed when update fails.

F. Executable data import script `tools/import_taipei_csv.py`: import downloaded public CSV, map column aliases, validate id/title/address/source and safe URL, normalize district/Traditional Chinese text, dedupe stable keys, sort deterministically, generate `knowledge.json` and integrity manifest. Provide CLI help, test fixture and Python unit tests. If genuine dataset CSV is not locally available, use ONLY labeled mock fixtures and do not invent municipal activity data.

G. Unit/widget/integration tests, usable README, privacy statement, model provenance ledger, `IMPLEMENTATION_STATUS.md`, documentation for Android and iOS build + real-device manual test.

## Non-negotiable constraints

- No Chinese model; no OpenAI/Gemini chat API or other cloud LLM service; no user prompt upload.
- Flutter + Dart shared UI. The only allowed AI provider is the device running an approved local GGUF or approved local embedding model (optional, not MVP).
- Minimum supported iOS for chosen llamadart runtime is **16.4**. Do not imply older iOS devices are covered. Check Android min SDK and ABI with installed actual versions rather than guessing.
- The official TownPass repo is GPL-3.0. Keep license notices and flag redistribution checks. Avoid non-permitted code copying.
- Gemma 3 usage needs license terms acceptance; no code to circumvent gated repositories.
- No formal diagnosis, welfare eligibility determination, or claims of real-time availability. Never silently downgrade to cloud LLM.
- All external links must come from vetted documents or an explicit official site fallback, never be fabricated by model text.

## Engineering instructions

1. Inspect environment (`pwd`, `ls`, `flutter --version`, `dart --version`, `xcodebuild -version` where available) and available source/fixtures. If no Flutter exists, still generate complete code and tests, then record unrun status.
2. Scaffold Flutter at `apps/city_ai_demo` if absent. Do not overwrite user files. Verify `pubspec.yaml` versions against pub.dev / installed package examples, especially Apple companion.
3. Implement pure domain and repositories with dependency injection. UI must depend on interfaces, NOT native package directly. Prefer official Flutter/Material and minimal packages. Never assume a platform-specific runtime works without build evidence.
4. Implement a deterministic retrieval fallback first. Build fake in-memory LLM for tests; ensure the production LLM is invoked only after explicit user opt-in and successful model load.
5. Add model provenance and secure downloader, then wire a legitimate SmolLM2 test model, respecting checksum checks. If cannot verify model URL and checksum, expose it as `needsConfiguration`, not as a successful download path.
6. Implement native LLM integration with `llamadart`, verify streaming and lifecycle through tests and actual device builds where available. Model must be re-used between messages; never repeatedly reload per question.
7. Implement data import, refresh and provenance UI. RAG prompt must say document content is untrusted, answer in Traditional Chinese, refuse inventing facts and cite [1] [2] indexes. Ground citations in retrieval IDs on UI even if generated answer omits them.
8. Test **offline-first** behavior, fallback, cancellation, unsupported platform, malformed data, manifest tamper, prompt injection, invalid URL and empty search.
9. Run `flutter pub get`, `dart format`, `flutter analyze`, `flutter test`, `python3 -m unittest discover -s tools/tests` as supported. Document exact commands and results; use `flutter build apk --debug` and `flutter build ios --no-codesign` where host/toolchain permit. iOS must not be reported as tested on non-macOS.
10. Add `IMPLEMENTATION_STATUS.md`: implemented / partial / blocked, tests with outputs, verified device models and next steps. Finish with brief summary for human reviewer.

## Strict MVP acceptance (all must be addressed)

- Flutter home screen and chat/search page render without requiring backend credentials.
- A known fixture query yields at least one source; unknown query yields explicit insufficient-data state.
- Turning on airplane mode does not block searching bundled/cached content; without installed model, no AI inference request is attempted.
- Prompt/response content is never sent to a remote endpoint; network client only supports explicit model/public-data operations.
- Untrusted retrieval text cannot silently become system instructions.
- Tampered files are rejected; old good dataset remains usable after failed update.
- SmolLM2 *only if legitimate download works* produces locally generated text after first download; otherwise app accurately reports model unavailable. No pretend response.
- Gemma option carries license message; absent legal distribution, the feature is intentionally locked with an actionable explanation.
- `flutter analyze` and `flutter test` pass wherever toolchain is present; document missing tests honestly.
- No China-developed model in config, fixtures, examples, dependencies activated at runtime or roadmap defaults.

## Explicitly OUT of scope

TaipeiPass login, personal records sync, health insurance card, medical guidance, payment, real-time booking, maps and location permission, vector database, embeddings, speech-to-text, text-to-speech, notifications, multi-account sync, municipal back-office admin portal, App Store deployment. These can follow after P0 validation.

## Final response format

Provide: changed file tree; runnable commands; test evidence (passed/failed/not run); model/license status; offline/privacy validation; blockers. Do not mark a platform "supported" based only on cross-platform documentation.
