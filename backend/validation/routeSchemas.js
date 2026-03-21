import { z } from 'zod';

export const routeSchemas = {
  auditMetadata: {
    query: z.object({}).strict(),
  },
  scannerExport: {
    body: z.object({
      format: z.enum(['json', 'csv']).default('json'),
      data: z.unknown(),
    }),
  },
};

export function validateRouteQuery(schema, query) {
  return schema.parse(query || {});
}

export function validateRouteBody(schema, body) {
  return schema.parse(body || {});
}

export function safeValidateRouteBody(schema, body) {
  return schema.safeParse(body || {});
}
