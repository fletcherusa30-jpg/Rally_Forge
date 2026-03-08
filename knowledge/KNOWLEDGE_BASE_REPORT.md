# Rally Forge Knowledge Base Report

Generated: 2026-03-08 01:12:44

## Folder Summary
- **pmc_raw**: 54 XML files
- **pmc_normalized**: 1 JSON files
- **pmc_entities**: 1 JSON files
- **pmc_indexes**:
  - mesh_index.json: False
  - entity_index.json: False
- **pmc_embeddings**: 0 embedding files
  - embedding_index.json: False
- **SQLite DB**: False
- **Logs**: 1 files

## Detected Issues
- Normalized JSON count is lower than raw XML count.
- Missing MeSH index.
- Missing entity index.
- Embedding coverage incomplete.
- Missing embedding index.
- SQLite DB missing (JSON fallback only).

## Recommendations
- Re-run ingestion to fill missing XML/JSON gaps.
- Rebuild entity index and MeSH index if missing.
- Rebuild embeddings for all PMCIDs.
- Install SQLite for faster queries (optional).
- Add validation pass to detect malformed XML/JSON.
- Add incremental ingestion to track new PMCIDs.
- Add semantic search UI tab in Rally Forge.
- Add exposure-condition graph export for analysis.
- Add confidence scoring for extracted entities.

## Notes
- This file is safe to upload to Copilot for analysis.
- No sensitive data included.
- Copilot can now repair, optimize, or extend the knowledge base.
