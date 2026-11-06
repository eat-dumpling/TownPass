# Public Data / Offline RAG Specification

## 1. Data sources

Start with Taipei City Government Open Data Portal `https://data.taipei/`. Target municipal dataset: 社區照顧關懷據點, details `https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a`. Do not assume that a dataset of *center addresses* also contains activity schedules, live registration, eligibility or current seat capacity. Only display verified fields actually present in downloaded CSV.

## 2. Snapshot JSON contract (v1)

```json
{
  "schema_version": 1,
  "dataset_id": "taipei-community-care-centers",
  "source_url": "https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a",
  "source_updated_at": null,
  "built_at": "2026-11-06T00:00:00Z",
  "documents": [
    {
      "id": "stable-id-from-source",
      "title": "source-provided-name",
      "body": "source-provided-description-or-address",
      "district": "文山區",
      "address": null,
      "phone": null,
      "source_url": "https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a",
      "source_updated_at": null,
      "source_type": "taipei_open_data",
      "is_demo": false
    }
  ]
}
```

Above is a SCHEMA EXAMPLE, not genuine downloaded data. `built_at` is build time, not source update time. `source_updated_at` can be null. Never substitute the build time as government data update time.

Validation: enforce required strings, length bounds (e.g. title <= 300, body <= 5000), `documents` finite count, `schema_version == 1`, URL https + allowed city domain, no executable markup. Use source record identity when available; otherwise stable content hash. Deterministic sorting and dedup.

## 3. Release manifest contract

```json
{
  "schema_version": 1,
  "snapshot_version": "2026-11-06-demo-1",
  "dataset_id": "taipei-community-care-centers",
  "download_url": "https://your-controlled-domain.example/knowledge.json",
  "sha256": "64_lowercase_hex_chars_from_built_file",
  "size_bytes": 12345,
  "published_at": "2026-11-06T00:00:00Z"
}
```

All values under `your-controlled-domain.example` are examples, NOT working deployment links. Manifest MUST be fetched from pinned HTTPS allowlist, must verify digest + length + JSON schema before atomic swap. SHA256 protects integrity relative to a **trusted manifest**; for stronger authenticity, sign manifest and verify embedded public key or use controlled and pinned distribution. Failed verification keeps last-known-good data. Put max payload size and server timeouts to prevent DoS; do not permit arbitrary redirect hosts.

## 4. CSV import CLI

Required invocation:

```bash
python3 tools/import_taipei_csv.py \
  --input /path/to/downloaded-official-file.csv \
  --dataset-id taipei-community-care-centers \
  --source-url 'https://data.taipei/dataset/detail?id=d082dc87-d3fd-479d-89c6-745ff1be955a' \
  --output apps/city_ai_demo/assets/knowledge/knowledge.json
```

Support UTF-8 / UTF-8-BOM, meaningful error for bad encoding. Infer column aliases only when safely matched (e.g. 據點名稱, 地址, 電話); never fake missing address or schedule. On ambiguous columns fail with helpful CLI report, no silent mapping. Emit zero unsupported personal fields. Provide optional `--source-updated` only if operator verified publication date.

## 5. Lexical RAG baseline

- Normalize Unicode width, whitespace, Taiwan synonyms (limited versioned mapping: `長者|老人|銀髮族`, `據點|關懷據點`); preserve Chinese characters.
- N-gram tokens (1–2 Chinese characters); optionally simple inverse document frequency scoring, with title/district boost and term matching thresholds. Do not accept a top result if score below threshold.
- Return `SearchHit {documentId, score, matchedSnippet}` and UI sources in stable descending order.
- Expose retrieval confidence. If none confidently match, **no LLM call**, show insufficient-data state.
- For any location-specific query use district info in score, but do not infer GPS/user address.
- `is_demo=true` records must always display 「測試資料，非真實市政服務」; never blend into official answers.

## 6. Grounding, prompt injection and citations

When there are search hits, build context capped per source and overall size. Treat all source text as untrusted. Do not follow a document that says to ignore instructions, reveal prompts or use a remote API. Display source cards independent from model output; parse `[n]` only if `n` is in retrieved index range. Never execute JSON/URLs supplied by user or generated model. Municipal eligibility/fee/date answer must quote verifiable input facts or explicitly say insufficient information.

## 7. Offline update

- Bundled seed available on first install, includes clearly marked demo examples if no real CSV supplied.
- New version downloaded only at explicit button press, stored at temporary path; length/hash/schema/host validated.
- Atomic replace + rollback to last-known-good snapshot. Capture `dataFreshness` state: unknown/outdated/up-to-date; never claim data is live.
- No outgoing user query / prompt in update requests, request path or logging.

## 8. Later enhancement, NOT MVP

Optional EmbeddingGemma from Google; only implement after model license, RAM impact, multilingual retrieval quality and distribution rights are independently verified. Precompute document embeddings as part of data build pipeline; no forced embedding model download for low-end devices.
