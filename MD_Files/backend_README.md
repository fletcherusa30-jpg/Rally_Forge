# Backend Architecture

Rally Forge's backend is an Express-based API and service layer that reads curated knowledge artifacts, exposes audit and scanning endpoints, and keeps data-access concerns behind explicit adapters.

## Structure

- `app.js`: application bootstrap, security middleware, route registration, and error pipeline.
- `api/`: route modules and route manifest definitions.
- `controllers/`: request handlers that translate validated inputs into service calls.
- `core/`: logging, canonical errors, and shared bootstrap primitives.
- `data/access/`: file system, Redis, MongoDB, and Postgres adapters.
- `engine/`: deterministic summary/build steps used by audit metadata and other derived outputs.
- `middleware/`: auth, logging, and security middleware.
- `services/`: business-oriented orchestration over knowledge files, audits, queues, and integrations.
- `validation/`: Zod schemas for public request and response contracts.

## Dependency Boundaries

- The backend package now declares the runtime libraries imported by backend modules directly.
- Zod is the canonical validation layer for public API payloads.
- Redis caching uses `ioredis` explicitly because `RedisDataSource.js` imports it directly.
- Root-level dependencies may still exist for workspace-wide scripts, but backend runtime can now be installed and audited independently from `backend/package.json`.

## Security Middleware

- Helmet is applied in `app.js` to reduce header-based risks such as clickjacking, MIME sniffing, and insecure framing.
- Compression is applied before route handling to reduce payload size without changing route behavior.
- CORS is configured from backend config and rejects unexpected browser origins in production.
- Request timeouts fail slow requests deterministically instead of leaving sockets open.
- General API rate limiting protects the public surface from burst abuse, while scanner endpoints keep their stricter limiter.

## Tooling

- `npm run typecheck`: strict JS type-checking via TypeScript with `checkJs` and no emit.
- `npm run test:system`: backend-facing audit and API smoke tests.
- `npm test`: runs the scoped backend regression suites.

## Notes

- Some repository-wide tests were moved during the earlier filesystem reorganization. If a script fails because of stale import paths in `tests/`, fix the test pathing separately from backend runtime code.
