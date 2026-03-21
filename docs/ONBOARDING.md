# Developer Onboarding Guide

## 1. Environment Setup
- Install Node.js LTS.
- Install npm or pnpm.
- Clone repository.
- Run: npm install
- Run: npm run dev

## 2. Repository Structure Overview
- /src/state -> unified dataset and global engine triggers.
- /src/engine -> condition engine, lay statement engine, derived signals.
- /src/tabs -> UI for each workflow tab.
- /src/schemas -> unified schema definitions.
- /src/tests -> test suites.
- /src/utils -> normalization and helpers.

## 3. Core Principles
- All logic lives in engines.
- All UI lives in tabs.
- All data lives in claimDataUnified.
- All updates must be silent.
- All tabs must trigger recompute.

## 4. Development Workflow
- Modify code.
- Run tests: npm run test
- Validate schema.
- Validate engine integration.
- Validate silent update behavior.

## 5. Required Knowledge
- React component model.
- State management.
- Schema-driven development.
- Deterministic logic patterns.

## 6. Prohibited Practices
- No local condition generation.
- No local derived signals.
- No direct lay statement manipulation.
- No duplicate schemas.
- No unnormalized data.

## 7. Testing Requirements
- All new code must include tests.
- All engines must maintain full coverage.
- All tabs must maintain integration coverage.
