# DD-214 Scanner Upload Prompt Pack

Purpose: compact prompts for external AI tools that should build or run against the DD-214 scanner contract.

Use these files together:

- `dd214-scanner-portable-spec.md`
- `dd214-scanner.schema.json`
- `dd214-scanner-few-shot-examples.md`

## 1. Universal Rules

Use these rules regardless of model:

- return JSON only
- follow the schema exactly
- use `null` for unknown values
- never invent service facts
- never summarize in prose
- never omit required keys
- preserve deployment source excerpts
- reject training-only references as deployments
- keep OCR garbage out of structured fields

## 2. Best Upload Order

Upload in this order:

1. `dd214-scanner-portable-spec.md`
2. `dd214-scanner.schema.json`
3. `dd214-scanner-few-shot-examples.md`
4. the OCR text or extracted text to parse

## 3. Generic Builder Prompt

Use this when asking another AI to design or implement the scanner.

```text
You are implementing a DD-214 military service scanner.

Read the attached specification, schema, and few-shot examples first.

Your requirements:
- Extract only the fields defined in the schema.
- Use semantic anchors first and positional fallback second.
- Be conservative.
- Use null instead of guesses.
- Suppress header noise, signature boilerplate, routing instructions, and OCR spillover.
- Do not turn training-only references into deployments.
- Do not turn garbage text into MOS entries.
- Normalize all dates to YYYY-MM-DD.
- Return stable keys every time.

If I ask for code, generate code that targets this schema.
If I ask for extraction, return valid JSON only.
```

## 4. Generic Runtime Extraction Prompt

Use this when you want the external AI to parse one DD-214 immediately.

```text
You are extracting structured data from DD-214 OCR text.

Follow the attached DD-214 scanner specification exactly.
Validate your output against the attached JSON schema.
Use the few-shot examples as behavioral guidance.

Output rules:
- Return JSON only.
- No markdown.
- No explanation.
- No comments.
- No extra keys.
- Preserve all required keys, even when values are null or empty arrays.
- Keep confidence conservative.

Important extraction constraints:
- Prefer anchored DD-214 block matches over stray dates or free text.
- Keep deployment extraction strict.
- Preserve award names like NAVY CROSS and PRESIDENTIAL UNIT CITATION.
- Extract MOS details only when a plausible code and title are present.
- Use null for uncertain assignment, transfer, and education fields.
```

## 5. ChatGPT Prompt

```text
Act as a deterministic DD-214 extraction engine.

Use the attached files as the source of truth:
1. portable specification
2. JSON schema
3. few-shot examples

Task:
Parse the DD-214 OCR text I provide and return one JSON object that matches the schema exactly.

Rules:
- JSON only
- no explanation
- no markdown
- no omitted keys
- null instead of guessed values
- conservative deployment logic
- conservative MOS parsing
- ignore document headers, signature blocks, and routing boilerplate

Before finalizing internally, check:
- entryDate and separationDate are plausible
- deployments are evidence-based
- training references did not become deployments
- OCR noise did not become structured values
- required keys are present
```

## 6. Claude Prompt

```text
You are a strict schema-bound DD-214 parser.

Use the attached specification, schema, and examples as binding constraints.

Read the OCR text carefully, extract only supported fields, normalize them, and return valid JSON.

Behavioral rules:
- prioritize precision over recall
- preserve stable structure
- keep uncertain fields null
- do not infer combat service from location alone
- do not infer deployments from training language
- do not emit narrative commentary
- do not add keys outside the schema

Return only the final JSON object.
```

## 7. Gemini Prompt

```text
Use the attached DD-214 scanner spec, schema, and examples to behave like a deterministic extraction pipeline.

Your job is to convert the OCR text into the exact canonical JSON contract.

Constraints:
- output valid JSON only
- preserve every required top-level key
- use null for uncertain values
- include field confidence and overall confidence
- include deployment source excerpts when deployment evidence exists
- keep deployment logic strict and evidence-based
- suppress OCR and header noise
- do not explain your reasoning
```

## 8. Recommended One-Line User Prompt After Upload

Once the files are uploaded, use this for each document:

```text
Parse the following DD-214 OCR text into the attached canonical schema and return JSON only.
```

## 9. If The External Model Keeps Free-Styling

If the model keeps summarizing instead of returning clean JSON, prepend this line:

```text
Your response will be machine-validated. Any prose, markdown, or missing keys is a failure.
```