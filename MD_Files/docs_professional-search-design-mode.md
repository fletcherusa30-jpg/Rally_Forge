# Professional Search (Design Mode Only)

## Objective
Implement Claude-style Professional Search UX with zero real API calls.

## Design Mode Guarantees
- No outbound Anthropic API requests.
- No real API key usage.
- No paid token usage.
- No billing events.

## Implementation
Service module:
- `app/frontend-modern/src/services/professionalSearch/claudeDesignMode.js`

UI integration:
- `app/frontend-modern/src/pages/KnowledgeBasePage.jsx`

Features included:
- Model tier selection (Haiku/Sonnet/Opus)
- Simulated request/response schema
- Simulated latency
- Simulated token usage
- Simulated request cost
- Simulated profit and margin (sale price `$1.50`)
- Placeholder API URL and key fields for future production handoff
- Retry loop in simulation path

## Pricing Model Used
- Haiku: input `$1.00/M`, output `$5.00/M`
- Sonnet: input `$3.00/M`, output `$15.00/M`
- Opus: input `$15.00/M`, output `$75.00/M`

## Mode Flag
Default mode: `design`

Production mode remains blocked by guardrail and requires explicit approval.
