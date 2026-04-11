# Resources Tab Snapshot

## Tab identity

- Label: Resources
- Primary route: `/resources`
- Icon token in shell nav: `05`

## Main page component

- Lazy route target: `app/frontend-modern/src/pages/resources/ResourcesHubPage`

## Purpose

The Resources tab provides transition-support tools and content (job board, resume builder, LinkedIn optimizer, SkillBridge, education, housing, legal, mental health, timeline, document vault).

## Notable nested routes

1. `/resources/job-board`
2. `/resources/resume-builder`
3. `/resources/linkedin-optimizer`
4. `/resources/skillbridge`
5. `/resources/education`
6. `/resources/housing`
7. `/resources/legal`
8. `/resources/mental-health`
9. `/resources/timeline`
10. `/resources/document-vault`

## Related navigation behavior

- Readiness gate key: `workflow.readiness.resources`.
- Evidence and support aliases redirect into Resources routes:
  - `/evidence`
  - `/evidence/upload`
  - `/support`
