# Profile Tab Snapshot

## Tab identity

- Label: Profile
- Primary route: `/profile`
- Edit route: `/profile/edit`
- Icon token in shell nav: `01`

## Main page component

- Lazy route target: `app/frontend-modern/src/pages/ProfilePage`

## Purpose

The Profile tab captures and edits claimant identity and contact data used by downstream readiness checks, development synthesis, benefits context, and claim generation.

## Related navigation behavior

- Readiness gate key: `workflow.readiness.profile`.
- Navigation guard blocks route changes when unsaved profile edits exist, unless user confirms leaving.
