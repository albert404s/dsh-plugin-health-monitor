import type { SecurityMetrics, Vulnerability } from '../../src/lib/types';
import type { JsonClient } from './http';

interface OsvQueryResult {
  vulns?: Array<{ id?: string; modified?: string }>;
}

interface OsvQueryBatchResponse {
  results?: OsvQueryResult[];
}

interface OsvVulnerability {
  id?: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  modified?: string;
  database_specific?: { severity?: string };
  affected?: Array<{
    ecosystem_specific?: { severity?: string };
  }>;
}

function normalizeSeverity(value: unknown): Vulnerability['severity'] {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low') {
    return normalized;
  }
  return 'unknown';
}

function vulnerabilityFromOsv(vuln: OsvVulnerability): Vulnerability {
  const severity =
    normalizeSeverity(vuln.database_specific?.severity) !== 'unknown'
      ? normalizeSeverity(vuln.database_specific?.severity)
      : normalizeSeverity(vuln.affected?.[0]?.ecosystem_specific?.severity);
  return {
    id: vuln.id ?? 'OSV-UNKNOWN',
    summary: vuln.summary?.trim() || vuln.details?.split('\n')[0]?.slice(0, 240) || null,
    severity,
    aliases: Array.isArray(vuln.aliases) ? vuln.aliases : [],
    modified: vuln.modified ?? null,
    url: `https://osv.dev/vulnerability/${encodeURIComponent(vuln.id ?? '')}`,
  };
}

/**
 * 必须在有精确 npm 包名和 latest 版本时调用。
 * 空结果只表示“OSV 未返回公开记录”，UI 不能将其表述为“安全”。
 */
export async function collectOsv(
  packageName: string | null,
  version: string | null,
  client: JsonClient,
  now: Date,
): Promise<SecurityMetrics> {
  const checkedAt = now.toISOString();
  if (!packageName || !version) {
    return {
      status: 'unavailable',
      exactMatch: false,
      packageName,
      version,
      vulnerabilities: [],
      checkedAt: null,
      reason: '缺少经核验的 npm 包名与精确版本，未完成漏洞检查。',
      queryUrl: packageName
        ? `https://osv.dev/list?ecosystem=npm&q=${encodeURIComponent(packageName)}`
        : null,
    };
  }

  const queryUrl = `https://osv.dev/list?ecosystem=npm&q=${encodeURIComponent(packageName)}`;
  try {
    const response = await client.post<OsvQueryBatchResponse>(
      'https://api.osv.dev/v1/querybatch',
      {
        queries: [
          {
            package: { name: packageName, ecosystem: 'npm' },
            version,
          },
        ],
      },
      { timeoutMs: 30_000, retries: 3 },
    );
    const found = response.data.results?.[0]?.vulns ?? [];
    const unique = new Map<string, { id: string; modified?: string }>();
    for (const item of found) {
      if (item.id) unique.set(item.id, { id: item.id, modified: item.modified });
    }

    const vulnerabilities: Vulnerability[] = [];
    for (const item of [...unique.values()].slice(0, 20)) {
      try {
        const detail = await client.get<OsvVulnerability>(
          `https://api.osv.dev/v1/vulns/${encodeURIComponent(item.id)}`,
          { timeoutMs: 20_000, retries: 2 },
        );
        vulnerabilities.push(
          vulnerabilityFromOsv({ ...detail.data, id: detail.data.id ?? item.id }),
        );
      } catch {
        vulnerabilities.push({
          id: item.id,
          summary: 'OSV 返回了该漏洞 ID，但详情请求失败。',
          severity: 'unknown',
          aliases: [],
          modified: item.modified ?? null,
          url: `https://osv.dev/vulnerability/${encodeURIComponent(item.id)}`,
        });
      }
    }

    return {
      status: 'checked',
      exactMatch: true,
      packageName,
      version,
      vulnerabilities,
      checkedAt,
      reason: null,
      queryUrl,
    };
  } catch (error) {
    return {
      status: 'error',
      exactMatch: false,
      packageName,
      version,
      vulnerabilities: [],
      checkedAt,
      reason: `OSV 请求失败，未完成漏洞检查：${
        error instanceof Error ? error.message : String(error)
      }`,
      queryUrl,
    };
  }
}
