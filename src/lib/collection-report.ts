import { z } from 'zod';
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const collectionReportSchema = z.object({
  version: z.literal(1), startedAt: z.iso.datetime(), completedAt: z.iso.datetime(),
  configuredPlugins: count, selectedPlugins: count, completedPlugins: count, deferredPlugins: count,
  maxPlugins: count.positive(), maxRequests: count.positive(), githubReserve: count,
  requestsMade: count, memoryCacheHits: count, revalidatedCacheHits: count, persistentCacheHits: count,
  githubRemaining: count.nullable(), githubResetAt: z.iso.datetime().nullable(),
  stopped: z.boolean(), stopReason: z.string().nullable(),
});
export type CollectionReport = z.infer<typeof collectionReportSchema>;
export function parseCollectionReport(value: unknown): CollectionReport | null {
  if (value === null) return null;
  const result = collectionReportSchema.safeParse(value);
  return result.success ? result.data : null;
}
