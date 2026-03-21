# DD-214 Corpus

Purpose: gold-standard OCR input and expected JSON output pairs for portable DD-214 extraction.

Layout:

- each case lives in its own folder
- `input.txt` contains OCR-like source text
- `expected.json` contains canonical output matching the portable schema

Validation:

```powershell
npm run validate:dd214-corpus
```

Single-file validation:

```powershell
npm run validate:dd214-output -- tests/dd214/corpus/modern-army-deployment/expected.json
```
