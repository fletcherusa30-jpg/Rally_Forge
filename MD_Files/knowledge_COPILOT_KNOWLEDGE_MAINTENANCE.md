# Rally Forge — Copilot Knowledge Maintenance Instructions

These instructions define how Copilot must analyze, maintain, and enhance the Rally Forge knowledge base located at:

C:\Dev\Rally Forge\knowledge

Copilot must follow these rules whenever reviewing, modifying, or generating content for this knowledge system.

---

# 1. Core Mission

Copilot’s mission is to ensure the Rally Forge knowledge base remains:

- Complete
- Accurate
- Non-duplicated
- Organized
- Domain-aware
- Production-safe
- Deterministic

Copilot must always preserve existing content unless explicitly instructed otherwise.

---

# 2. Folder Integrity Rules

Copilot must ensure:

### ✔ No empty folders
If a folder contains no files, Copilot must generate:

- PURPOSE.md
- SUMMARY.md
- INDEX.json

### ✔ Every folder must contain:
- PURPOSE.md
- SUMMARY.md
- INDEX.json

### ✔ No placeholder content
Copilot must remove or replace:

- “placeholder”
- “lorem”
- “TBD”
- “insert here”
- Empty files
- Files under 200 bytes (unless intentional)

---

# 3. Duplicate Detection Rules

Copilot must detect duplicates using:

### ✔ SHA‑256 hash (primary)
Two files with identical hashes are duplicates.

### ✔ Structural similarity (secondary)
Flag files that:
- Have identical names but different content
- Have identical content but different names
- Are near-identical in size

### ✔ JSON merging
If two JSON files contain overlapping objects:
- Merge
- Deduplicate by key fields
- Preserve all unique entries

### ✔ Never delete automatically
Instead:
- Log duplicates
- Add to duplicate report
- Suggest remediation

---

# 4. Contact Intelligence Rules

Copilot must maintain the contact system under:

VAknow/contacts/

### ✔ Ensure no duplicate contacts
Deduplicate by:

name + scope + category + region

### ✔ Ensure schema compliance
All contacts must follow:

{
  "name": "",
  "scope": "",
  "category": "",
  "region": "",
  "website": "",
  "phone": "",
  "notes": ""
}

### ✔ Ensure routing integrity
Copilot must maintain:

contacts_routing.json

---

# 5. Knowledge Completion Rules

Copilot must ensure:

### ✔ All domains contain real content
Including:

- State benefits
- Medical conditions
- Toxic exposures
- USC summaries
- Federal benefits
- VAknow program logic
- CFR ↔ USC ↔ VAknow crosswalks

### ✔ All SUMMARY.md files must contain:
- Purpose
- Scope
- How AI should use the folder
- Metadata

### ✔ All INDEX.json files must contain:
- File list
- Metadata
- Timestamp

---

# 6. Change Review Rules

Whenever Copilot reviews changes, it must:

### ✔ Scan for:
- New files
- Modified files
- Deleted files
- Duplicates
- Structural inconsistencies
- Missing indexes
- Missing summaries
- Missing schemas

### ✔ Generate a change report:
- knowledge_change_report.json
- knowledge_change_summary.md

### ✔ Recommend actions:
- Merge
- Normalize
- Expand
- Repair
- Quarantine

---

# 7. Safety & Preservation Rules

Copilot must:

### ✔ Never overwrite existing content unless explicitly instructed
### ✔ Never delete files automatically
### ✔ Never remove user-generated content
### ✔ Always preserve original structure
### ✔ Always log changes

---

# 8. Output Requirements

Copilot must output:

- Clear, structured recommendations
- Deterministic actions
- No ambiguity
- No partial solutions
- No hallucinated content

---

# 9. Execution Flow

When Copilot is asked to review or modify the knowledge base:

1. Scan the entire tree
2. Detect duplicates
3. Detect missing files
4. Detect incomplete files
5. Detect structural issues
6. Generate recommendations
7. Generate missing content
8. Update indexes
9. Update routing
10. Produce a final report

---

# 10. Final Rule

Copilot must treat the Rally Forge knowledge base as a **mission-critical system**.
All actions must be:

- Safe
- Deterministic
- Auditable
- Reversible
- Complete

END OF INSTRUCTIONS
