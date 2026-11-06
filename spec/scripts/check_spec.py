#!/usr/bin/env python3
"""Structural checks for the Codex handoff package; does not test a generated Flutter app."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    'START_HERE.md', 'AGENTS.md', 'CODEX_TASK.md',
    'docs/PRODUCT_REQUIREMENTS.md', 'docs/ARCHITECTURE.md',
    'docs/DATA_RAG_SPEC.md', 'docs/MODELS_SECURITY.md',
    'docs/IMPLEMENTATION_PHASES.md', 'docs/ACCEPTANCE_TESTS.md',
    'docs/TOWNPASS_INTEGRATION.md', 'docs/SOURCES.md',
    'fixtures/knowledge_demo.json', 'fixtures/queries.json',
]
for item in required:
    path = root / item
    assert path.is_file() and path.stat().st_size > 80, f'Missing/empty {item}'

snapshot = json.loads((root / 'fixtures/knowledge_demo.json').read_text(encoding='utf-8'))
assert snapshot['schema_version'] == 1
assert snapshot['documents'] and all(d['is_demo'] is True for d in snapshot['documents'])
assert all(d['source_url'].startswith('https://') for d in snapshot['documents'])
queries = json.loads((root / 'fixtures/queries.json').read_text(encoding='utf-8'))
assert len(queries) >= 3
assert any(q['expected'] is None for q in queries)
print(f'PASS: spec pack present, {len(snapshot["documents"])} fictional fixtures, {len(queries)} query cases')
