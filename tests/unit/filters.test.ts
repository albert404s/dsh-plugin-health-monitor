import { describe, expect, it } from 'vitest';
import { scorePlugins } from '../../src/lib/scoring';
import {
  filterPlugins,
  hasActiveFilters,
  paginate,
  sortPlugins,
  stateFromSearchParams,
  stateToSearchParams,
  DEFAULT_FILTER_STATE,
} from '../../src/lib/filters';
import { NOW, makeSeed } from './helpers';

const plugins = scorePlugins(
  [
    makeSeed({
      id: 'context-pro',
      name: 'DSH Context',
      category: 'context',
      description: '上下文可视化与管理',
      stars: 5000,
      downloads30d: 900_000,
      lastCommitDaysAgo: 2,
    }),
    makeSeed({
      id: 'agent-team',
      name: 'Agent Team',
      category: 'agents',
      description: '多智能体工作流',
      stars: 900,
      downloads30d: null,
      lastCommitDaysAgo: 400,
      issuesOpened90d: 0,
      prsOpened90d: 0,
      releaseDaysAgo: null,
      securityStatus: 'unavailable',
    }),
    makeSeed({
      id: 'sidebar-legacy',
      name: 'Old Sidebar',
      category: 'interface',
      description: 'legacy sidebar',
      stars: 600,
      downloads30d: 10_000,
      archived: true,
      lastCommitDaysAgo: 300,
    }),
  ],
  NOW,
);

describe('plugin filtering', () => {
  it('searches name, description, repository and Chinese text', () => {
    expect(filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, query: 'context' })).toHaveLength(1);
    expect(filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, query: '上下文' })).toHaveLength(1);
    expect(filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, query: 'agent-team' })).toHaveLength(1);
    expect(filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, query: 'ไม่พบ' })).toHaveLength(0);
  });

  it('filters by category, risk, maintenance band and data availability', () => {
    expect(
      filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, category: 'interface' }),
    ).toHaveLength(1);
    expect(filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, risk: 'high' })).toHaveLength(1);
    expect(
      filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, downloads: 'missing' }).map(
        (plugin) => plugin.id,
      ),
    ).toEqual(['agent-team']);
    expect(
      filterPlugins(plugins, { ...DEFAULT_FILTER_STATE, maintenance: 'slow' }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('sorts by popularity, completeness and name', () => {
    expect(sortPlugins(plugins, 'popularity')[0].id).toBe('context-pro');
    expect(sortPlugins(plugins, 'name')[0].name).toBe('Agent Team');
    expect(sortPlugins(plugins, 'completeness')[0].scores.completeness.score).toBe(100);
  });

  it('paginates without losing the total count', () => {
    const many = Array.from({ length: 13 }, (_, index) =>
      makeSeed({ id: `plugin-${index}`, name: `Plugin ${index}` }),
    );
    const scored = scorePlugins(many, NOW);
    const result = paginate(scored, 2, 5);
    expect(result.total).toBe(13);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].name).toBe('Plugin 5');
  });
});

describe('filter URL state', () => {
  it('round-trips supported values and drops invalid values', () => {
    const params = stateToSearchParams({
      query: 'context',
      category: 'context',
      maintenance: 'active',
      risk: 'high',
      data: 'high',
      downloads: 'available',
      sort: 'maintenance',
      page: 2,
    });
    const restored = stateFromSearchParams(params);
    expect(restored).toEqual({
      query: 'context',
      category: 'context',
      maintenance: 'active',
      risk: 'high',
      data: 'high',
      downloads: 'available',
      sort: 'maintenance',
      page: 2,
    });

    const invalid = stateFromSearchParams(new URLSearchParams('risk=wat&sort=oops&page=-3'));
    expect(invalid.risk).toBe('all');
    expect(invalid.sort).toBe('popularity');
    expect(invalid.page).toBe(1);
  });

  it('detects active filters independently of sorting', () => {
    expect(hasActiveFilters(DEFAULT_FILTER_STATE)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTER_STATE, sort: 'stars' })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTER_STATE, query: 'dsh' })).toBe(true);
  });
});
