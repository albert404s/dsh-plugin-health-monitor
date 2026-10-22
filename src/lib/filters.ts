import type { PluginRecord } from './types';

export type SortKey =
  | 'popularity'
  | 'maintenance'
  | 'stars'
  | 'downloads'
  | 'commits'
  | 'recent'
  | 'completeness'
  | 'name';

export type MaintenanceFilter = 'all' | 'active' | 'steady' | 'slow' | 'insufficient';
export type RiskFilter = 'all' | 'high' | 'medium' | 'unknown' | 'low';
export type DataFilter = 'all' | 'high' | 'medium' | 'low';
export type DownloadFilter = 'all' | 'available' | 'missing';
export type RankingLimit = number | 'all';

export interface PluginFilterState {
  query: string;
  category: string;
  maintenance: MaintenanceFilter;
  risk: RiskFilter;
  data: DataFilter;
  downloads: DownloadFilter;
  sort: SortKey;
  top: RankingLimit;
  page: number;
}

export const DEFAULT_FILTER_STATE: PluginFilterState = {
  query: '',
  category: 'all',
  maintenance: 'all',
  risk: 'all',
  data: 'all',
  downloads: 'all',
  sort: 'popularity',
  top: 'all',
  page: 1,
};

export const PAGE_SIZE = 8;

export function parseRankingLimit(value: string | null): RankingLimit {
  if (!value || !/^[1-9]\d{0,3}$/.test(value)) return 'all';
  const count = Number(value);
  return count <= 1000 ? count : 'all';
}

export function maintenanceBand(plugin: PluginRecord): Exclude<MaintenanceFilter, 'all'> {
  if (plugin.scores.maintenance.status === 'insufficient') return 'insufficient';
  const score = plugin.scores.maintenance.score ?? 0;
  if (score >= 75) return 'active';
  if (score >= 55) return 'steady';
  return 'slow';
}

export function completenessBand(plugin: PluginRecord): Exclude<DataFilter, 'all'> {
  const score = plugin.scores.completeness.score;
  if (score >= 85) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function matchesQuery(plugin: PluginRecord, query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  if (!normalized) return true;
  const haystack = [
    plugin.name,
    plugin.repo,
    plugin.repository.description ?? '',
    plugin.repository.language ?? '',
    plugin.repository.license ?? '',
    plugin.curatorNote,
    plugin.installCommand,
    plugin.category,
    ...plugin.repository.topics,
  ]
    .join(' ')
    .toLocaleLowerCase('zh-CN');
  return haystack.includes(normalized);
}

export function filterPlugins(
  plugins: PluginRecord[],
  state: PluginFilterState,
): PluginRecord[] {
  return plugins.filter((plugin) => {
    if (!matchesQuery(plugin, state.query)) return false;
    if (state.category !== 'all' && plugin.category !== state.category) return false;
    if (state.maintenance !== 'all' && maintenanceBand(plugin) !== state.maintenance) {
      return false;
    }
    if (state.risk !== 'all' && plugin.scores.risk.level !== state.risk) return false;
    if (state.data !== 'all' && completenessBand(plugin) !== state.data) return false;
    if (state.downloads === 'available' && !(plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null)) {
      return false;
    }
    if (state.downloads === 'missing' && plugin.npm.status === 'verified' && plugin.npm.downloads30d !== null) {
      return false;
    }
    return true;
  });
}

function compareNullable(
  left: number | null,
  right: number | null,
  direction: 'asc' | 'desc',
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'desc' ? right - left : left - right;
}

export function sortPlugins(plugins: PluginRecord[], sort: SortKey): PluginRecord[] {
  const copy = [...plugins];
  copy.sort((a, b) => {
    const nameComparison = a.name.localeCompare(b.name, 'zh-CN');
    switch (sort) {
      case 'name':
        return nameComparison;
      case 'maintenance': {
        const comparison = compareNullable(
          a.scores.maintenance.score,
          b.scores.maintenance.score,
          'desc',
        );
        return comparison !== 0 ? comparison : nameComparison;
      }
      case 'stars':
        return b.github.stars - a.github.stars || nameComparison;
      case 'downloads': {
        const aDownloads = a.npm.status === 'verified' ? a.npm.downloads30d : null;
        const bDownloads = b.npm.status === 'verified' ? b.npm.downloads30d : null;
        const comparison = compareNullable(aDownloads, bDownloads, 'desc');
        return comparison !== 0 ? comparison : nameComparison;
      }
      case 'commits':
        return b.github.commits30d - a.github.commits30d || nameComparison;
      case 'recent': {
        const aTime = a.github.lastCommitAt ? new Date(a.github.lastCommitAt).getTime() : 0;
        const bTime = b.github.lastCommitAt ? new Date(b.github.lastCommitAt).getTime() : 0;
        return bTime - aTime || nameComparison;
      }
      case 'completeness': {
        const comparison = b.scores.completeness.score - a.scores.completeness.score;
        return comparison !== 0 ? comparison : nameComparison;
      }
      case 'popularity':
      default: {
        const comparison = compareNullable(
          a.scores.popularity.score,
          b.scores.popularity.score,
          'desc',
        );
        return comparison !== 0 ? comparison : nameComparison;
      }
    }
  });
  return copy;
}

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE): {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
} {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    total,
  };
}

/** Apply the display limit after filtering and sorting, before pagination. */
export function rankPlugins(plugins: PluginRecord[], state: PluginFilterState): {
  items: PluginRecord[];
  matched: number;
} {
  const sorted = sortPlugins(filterPlugins(plugins, state), state.sort);
  return { items: state.top === 'all' ? sorted : sorted.slice(0, state.top), matched: sorted.length };
}

export function categories(plugins: PluginRecord[]): string[] {
  return [...new Set(plugins.map((plugin) => plugin.category))].sort((a, b) =>
    a.localeCompare(b, 'zh-CN'),
  );
}

export function hasActiveFilters(state: PluginFilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.category !== 'all' ||
    state.maintenance !== 'all' ||
    state.risk !== 'all' ||
    state.data !== 'all' ||
    state.downloads !== 'all'
  );
}

export function stateToSearchParams(state: PluginFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category !== 'all') params.set('category', state.category);
  if (state.maintenance !== 'all') params.set('maintenance', state.maintenance);
  if (state.risk !== 'all') params.set('risk', state.risk);
  if (state.data !== 'all') params.set('data', state.data);
  if (state.downloads !== 'all') params.set('downloads', state.downloads);
  if (state.sort !== 'popularity') params.set('sort', state.sort);
  if (state.top !== 'all') params.set('top', String(state.top));
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

export function stateFromSearchParams(params: URLSearchParams): PluginFilterState {
  const maintenance = params.get('maintenance');
  const risk = params.get('risk');
  const data = params.get('data');
  const downloads = params.get('downloads');
  const sort = params.get('sort');
  const page = Number(params.get('page') ?? '1');
  return {
    query: params.get('q') ?? '',
    category: params.get('category') ?? 'all',
    maintenance: ['active', 'steady', 'slow', 'insufficient'].includes(maintenance ?? '')
      ? (maintenance as MaintenanceFilter)
      : 'all',
    risk: ['high', 'medium', 'unknown', 'low'].includes(risk ?? '')
      ? (risk as RiskFilter)
      : 'all',
    data: ['high', 'medium', 'low'].includes(data ?? '') ? (data as DataFilter) : 'all',
    downloads: ['available', 'missing'].includes(downloads ?? '')
      ? (downloads as DownloadFilter)
      : 'all',
    sort: [
      'popularity',
      'maintenance',
      'stars',
      'downloads',
      'commits',
      'recent',
      'completeness',
      'name',
    ].includes(sort ?? '')
      ? (sort as SortKey)
      : 'popularity',
    top: parseRankingLimit(params.get('top')),
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}
