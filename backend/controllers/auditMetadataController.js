import { Errors } from '../core/index.js';
import { getAuditMetadataBundle } from '../services/auditMetadataService.js';
import { runAuditArchitectureScan } from '../services/auditArchitectureScanService.js';
import { resolveAllAuditRecommendations } from '../services/auditResolutionService.js';
import { routeSchemas } from '../validation/routeSchemas.js';

export async function getAuditMetadata(req, res) {
  const parsedQuery = routeSchemas.auditMetadata.query.safeParse(req.query || {});
  if (!parsedQuery.success) {
    const queryKeys = Object.keys(req.query || {});
    throw Errors.badRequest('This endpoint does not accept query parameters', {
      allowedQueryParameters: [],
      received: queryKeys,
    });
  }

  const data = await getAuditMetadataBundle();
  return res.json({ success: true, data });
}

export async function postAuditScan(req, res) {
  const parsedQuery = routeSchemas.auditMetadata.query.safeParse(req.query || {});
  if (!parsedQuery.success) {
    const queryKeys = Object.keys(req.query || {});
    throw Errors.badRequest('This endpoint does not accept query parameters', {
      allowedQueryParameters: [],
      received: queryKeys,
    });
  }

  const data = await runAuditArchitectureScan();
  return res.json({ success: true, data });
}

export async function postAuditResolveAll(req, res) {
  const parsedQuery = routeSchemas.auditMetadata.query.safeParse(req.query || {});
  if (!parsedQuery.success) {
    const queryKeys = Object.keys(req.query || {});
    throw Errors.badRequest('This endpoint does not accept query parameters', {
      allowedQueryParameters: [],
      received: queryKeys,
    });
  }

  const data = await resolveAllAuditRecommendations();
  return res.json({ success: true, data });
}
