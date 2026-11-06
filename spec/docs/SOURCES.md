# Sources and Verification Notes

Verified for writing this spec on **2026-11-06**. These URLs are public references for developer review, not authorization to use municipal production APIs or redistribute gated models.

1. TownPass official open source repository, Flutter, license GPL-3.0, getting started: https://github.com/taipei-doit/TownPass
2. TownPass `.fvmrc` at main (checked: listed Flutter 3.47.6): https://github.com/taipei-doit/TownPass/blob/main/.fvmrc
3. TownPass `pubspec.yaml` for actual dependencies: https://github.com/taipei-doit/TownPass/blob/main/pubspec.yaml
4. `llamadart` 0.17.5 package documentation (official registry): https://pub.dev/packages/llamadart/versions/0.17.5
5. `llamadart` API reference (check resolved version, not only example from older API): https://pub.dev/documentation/llamadart/latest/
6. `llamadart` Apple companion (verify pairing): https://pub.dev/packages/llamadart_llama_cpp_flutter
7. Google Gemma 3 1B **instruction-tuned** QAT GGUF (gated by license agreement): https://huggingface.co/google/gemma-3-1b-it-qat-q4_0-gguf
8. Hugging Face SmolLM2-135M-Instruct original model: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct
9. Candidate third-party quantized SmolLM2 GGUF (requires artifact provenance/hash audit): https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF
10. Taipei City Government data portal: https://data.taipei/
11. Taipei City Government community care centres dataset: https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a

## Known uncertainties / implementation gates

- Package versions change quickly; pin a compatible exact dependency set after `flutter pub get` and document it. The current API snippet in package readme used `LlamaEngine.load(LlamaModel(ModelSource.parse(...)))`, `create(...).text()` and `dispose()`, but look at the actually installed package when generating production code.
- Google Gemma repository is gated even though the model page is visible. Download/re-distribution rights must be evaluated. A link to a GGUF is **not** permission to ship it to every citizen.
- SmolLM2 quantized GGUF artifacts should be hash/provenance reviewed. Don't invent sha256 values.
- Open data center/phone/address records are not live event dates, enrollment slots, eligibility decisions, or personal health records.
- TownPass open source is not necessarily the full app build currently distributed in app stores. No special municipal API access is implied.
- Android/Apple on-device performance is unknown until real target hardware testing; allow retrieval-only fallback.
