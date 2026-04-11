# Dashboard Tab Snapshot

## Tab identity

- Label: Dashboard
- Primary route: `/`
- Alias route: `/dashboard`
- Icon token in shell nav: `HM`

## Main page component

- Lazy route target: `app/frontend-modern/src/dashboard/DashboardPage`

## Purpose

The Dashboard tab is the workspace landing page. It surfaces readiness and task context so users can decide whether to continue profile completion, evidence development, rating review, or claim generation.

## Related navigation behavior

- Listed as the first primary workflow step in `primaryLinks`.
- Readiness route key is `/` and is treated as always available (`true`) in app shell readiness mapping.
