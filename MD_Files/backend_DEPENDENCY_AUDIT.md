# Backend Dependency Audit

## Summary

The backend package previously declared only a subset of the libraries imported by backend runtime modules. That made installs non-deterministic because the backend relied on root-level dependencies being present.

## Added Runtime Dependencies

- `bcryptjs`: used by `middleware/auth.js` for password hashing.
- `bull`: used by backend queue modules.
- `dotenv`: used by `config.js` for environment loading.
- `ioredis`: imported directly by `data/access/RedisDataSource.js`.
- `jsonwebtoken`: used by `middleware/auth.js`.
- `mongodb`: used by Mongo data-access modules.
- `morgan`: used by `middleware/logging.js`.
- `pdfjs-dist`: used by scanning and document-processing modules.
- `pg`: used by Postgres data-access modules.
- `tesseract.js`: used by OCR/scanner flows.
- `zod`: used by request and response validation schemas.

## Removed Runtime Dependencies

- `express-validator`: not part of the active request-validation path. Public validation is already handled through Zod schemas.

## Follow-up Guidance

- Keep backend-only runtime imports declared in `backend/package.json` even if the root workspace also depends on them.
- Treat root-package duplicates as a workspace concern, not as the backend's installation boundary.
- If Redis becomes fully optional in every deployment mode, keep `ioredis` installed but allow runtime degradation instead of hiding the dependency.
