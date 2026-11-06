# Integrating into the Official TownPass Open Source App

> This is a feature-branch integration guide, NOT proof of permission to edit the official production TaipeiPass app.

Official repository: `https://github.com/taipei-doit/TownPass`, currently a Flutter project with Android/iOS directories and GPL-3.0. It documents `flutter pub get`, `dart run build_runner build`, `flutter run`. Verify its actual files at the checked-out commit; do not assume an exact current class or router from an old blog post. The published `.fvmrc` showed Flutter 3.47.6 when this spec was prepared, but re-check on checkout.

## Integrate after standalone MVP works

1. Fork TownPass, clone YOUR fork; create `feat/offline-city-ai` branch. Save upstream commit hash in implementation notes.
2. Inspect actual `pubspec.yaml`, `.fvmrc`, `lib/main.dart`, app router/navigation/state management, `android/`, `ios/`, existing generated files, licensing and build flavors. Audit SDK and plugin compatibility **before** adding native inference.
3. Copy/adapt feature modules from `apps/city_ai_demo/lib/features/city_ai` into a compatible TownPass feature directory, preserving domain/ports/data/presentation separation. Don't overwrite main.dart or router wholesale.
4. Add an accessible "離線城市 AI" entry in an existing navigational affordance, respecting TownPass typography/theme. Show a **PoC** disclaimer. Do not spoof official government endorsement.
5. Add local bundled snapshot into `assets` + pubspec; register dependency injection under existing patterns, avoid changing unrelated services.
6. Add `llamadart` and Apple companion in compatible versions; review min iOS >=16.4 implications. If raising TownPass's minimum deployment target would exclude current users, **do not silently raise it**: document product decision, evaluate segregated demo build/runtime or independent PoC first.
7. Re-run repo's generated-code command if the app uses build_runner; do not manually change generated files where source generation is required.
8. Confirm model downloads do not require TownPass auth or access to private APIs. Keep no prompt uploads and no logs with private content.
9. Check GPL-3.0 derivative obligations, third-party dependency/model licenses, security/privacy notices and any contribution guidelines.
10. Test existing regression suite, new unit tests and both platform builds where SDK permits. Document broken upstream issues separately from new feature regressions.

## Blocking conditions

- Incompatible Flutter/Dart/SwiftPM versions: stop and explain incompatibility + alternative demo path, not destructive SDK upgrade.
- Gemma model license unresolved: leave generative-quality model disabled; offline lexical retrieval still works.
- Municipal API or login required: use public datasets only. Do not invent credentials or mock real citizen identity.
- App minimum iOS conflicts with LLM runtime: escalate product decision; do not exclude old devices without explicit acceptance.

## Suggested follow-up Codex task in the TownPass fork

```text
請閱讀這份 docs/TOWNPASS_INTEGRATION.md 與現有 TownPass repo 的程式架構。
不要覆寫原有 routing/main.dart。以 feature branch 把已驗證的 City AI feature 移入 TownPass；先做離線公開資料檢索 UI，再接已授權的本機模型。
偵測目前 Flutter/iOS/Android 版本與 llamadart 的衝突，不能擅自提高最低系統需求；需要產品決策時列出風險。完成後跑既有及新增測試，列出實測而非推測的結果。
```
