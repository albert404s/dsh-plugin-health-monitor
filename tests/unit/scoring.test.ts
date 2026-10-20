import { describe, expect, it } from 'vitest';
import {
  completeness,
  computeStats,
  hasQuadrantData,
  logNormalize,
  maintenanceScore,
  popularityScore,
  quadrantOf,
  riskAssessment,
  scorePlugins,
} from '../../src/lib/scoring';
import { makeSeed, vulnerability, NOW } from './helpers';

describe('logNormalize', () => {
  it('normalizes the min/max population to 0 and 100', () => {
    expect(logNormalize(0, [0, 10, 1000])).toBe(0);
    expect(logNormalize(1000, [0, 10, 1000])).toBe(100);
  });

  it('returns 50 when all values are identical instead of inventing variance', () => {
    expect(logNormalize(10, [10, 10])).toBe(50);
  });

  it('does not treat an empty population as zero', () => {
    expect(logNormalize(10, [])).toBeNull();
  });
});

describe('popularity score', () => {
  it('renormalizes weights when verified downloads are missing, without scoring it as zero', () => {
    const a = makeSeed({ id: 'a', stars: 100, downloads30d: 1000 });
    const b = makeSeed({ id: 'b', stars: 1000, downloads30d: null });
    const c = makeSeed({ id: 'c', stars: 10000, downloads30d: 1_000_000 });
    const scored = scorePlugins([a, b, c], NOW);
    const noDownloads = scored.find((plugin) => plugin.id === 'b')!;
    const popularity = noDownloads.scores.popularity;
    const downloadComponent = popularity.components.find(
      (component) => component.key === 'downloads',
    )!;
    const starComponent = popularity.components.find((component) => component.key === 'stars')!;
    expect(downloadComponent.included).toBe(false);
    expect(downloadComponent.effectiveWeight).toBe(0);
    expect(starComponent.effectiveWeight).toBe(1);
    expect(popularity.status).toBe('scored');
    expect(popularity.confidence).toBe('medium');
    expect(popularity.coverage).toBe(0.45);
    expect(popularity.missing).toHaveLength(1);
    expect(hasQuadrantData(noDownloads)).toBe(false);
  });

  it('uses log scale so one huge download outlier does not collapse the middle to zero', () => {
    const small = makeSeed({ id: 'small', stars: 50, downloads30d: 500 });
    const middle = makeSeed({ id: 'middle', stars: 500, downloads30d: 20_000 });
    const huge = makeSeed({ id: 'huge', stars: 50_000, downloads30d: 5_000_000 });
    const scored = scorePlugins([small, middle, huge], NOW);
    const smallScore = scored.find((plugin) => plugin.id === 'small')!.scores.popularity.score!;
    const middleScore = scored.find((plugin) => plugin.id === 'middle')!.scores.popularity.score!;
    const hugeScore = scored.find((plugin) => plugin.id === 'huge')!.scores.popularity.score!;
    expect(middleScore).toBeGreaterThan(0);
    expect(middleScore).toBeLessThan(hugeScore);
    expect(hugeScore).toBeGreaterThan(smallScore);
  });
});

describe('maintenance score', () => {
  it('does not penalize a project merely for having no new issues, PRs or releases', () => {
    const seed = makeSeed({
      issuesOpened90d: 0,
      prsOpened90d: 0,
      releaseDaysAgo: null,
      lastCommitDaysAgo: 10,
    });
    const score = maintenanceScore(seed, NOW);
    expect(score.status).toBe('scored');
    expect(score.score).toBeGreaterThan(50);
    const excluded = score.components.filter((component) => !component.included);
    expect(excluded.map((component) => component.key)).toEqual(
      expect.arrayContaining(['issueHandling', 'pullRequests', 'release']),
    );
  });

  it('reduces the issue weight when the sample is small', () => {
    const seed = makeSeed({ issuesOpened90d: 2, issuesClosed90d: 2 });
    const score = maintenanceScore(seed, NOW);
    const issue = score.components.find((component) => component.key === 'issueHandling')!;
    expect(issue.sampleSize).toBe(2);
    expect(issue.included).toBe(true);
    expect(issue.effectiveWeight).toBeLessThan(issue.weight);
  });

  it('returns insufficient rather than a pseudo-precise score when evidence coverage is too low', () => {
    const seed = makeSeed({
      issuesOpened90d: 0,
      prsOpened90d: 0,
      releaseDaysAgo: null,
    });
    seed.github.lastCommitAt = null;
    seed.availability.commits = false;
    seed.availability.issues = false;
    seed.availability.releases = false;
    const score = maintenanceScore(seed, NOW);
    expect(score.status).toBe('insufficient');
    expect(score.score).toBeNull();
    expect(score.coverage).toBeLessThan(0.45);
  });

  it('excludes a disabled GitHub Pull Requests feature instead of treating it as zero', () => {
    const seed = makeSeed({ prsAvailable: false, prsOpened90d: 0, prsMerged90d: 0 });
    const score = maintenanceScore(seed, NOW);
    const pr = score.components.find((component) => component.key === 'pullRequests')!;
    expect(pr.included).toBe(false);
    expect(pr.rawLabel).toBe('PR 功能不可用');
  });
});

describe('risk assessment', () => {
  it('keeps risk unknown when OSV matching is unavailable', () => {
    const score = riskAssessment(makeSeed({ securityStatus: 'unavailable' }), NOW);
    expect(score.level).toBe('unknown');
    expect(score.label).toBe('风险信息不完整');
  });

  it('raises high risk for an archived repo or a high-severity OSV record', () => {
    const archived = riskAssessment(makeSeed({ archived: true }), NOW);
    expect(archived.level).toBe('high');
    const vulnerable = riskAssessment(
      makeSeed({ securityVulns: [vulnerability('critical')] }),
      NOW,
    );
    expect(vulnerable.level).toBe('high');
  });

  it('does not label an empty OSV result as safe or zero risk', () => {
    const score = riskAssessment(makeSeed(), NOW);
    expect(score.level).toBe('low');
    expect(score.label).toBe('未见公开风险记录');
    expect(score.limitations.join(' ')).toContain('不构成安全审计');
  });
});

describe('completeness and quadrants', () => {
  it('counts missing domains and distinguishes them from real zero values', () => {
    const seed = makeSeed({
      downloads30d: null,
      missingAvailability: ['pullRequests'],
    });
    const result = completeness(seed.availability, seed);
    expect(result.total).toBe(7);
    expect(result.available).toBe(5);
    expect(result.score).toBe(71);
    expect(result.missing.map((item) => item.key)).toEqual(
      expect.arrayContaining(['npm', 'pullRequests']),
    );
  });

  it('does not force plugins without both axes into a quadrant', () => {
    const seed = makeSeed({ downloads30d: null });
    const [plugin] = scorePlugins([seed], NOW);
    expect(hasQuadrantData(plugin)).toBe(false);
  });

  it('places only scored plugins and exposes the quadrant boundaries', () => {
    expect(quadrantOf(70, 70)).toBe('hot-healthy');
    expect(quadrantOf(70, 40)).toBe('hot-watch');
    expect(quadrantOf(30, 70)).toBe('niche-active');
    expect(quadrantOf(30, 20)).toBe('quiet');
  });

  it('computes aggregate stats without treating missing downloads as zero', () => {
    const seeds = [
      makeSeed({ id: 'a', stars: 100, downloads30d: 1000 }),
      makeSeed({ id: 'b', stars: 200, downloads30d: null }),
    ];
    const stats = computeStats(scorePlugins(seeds, NOW));
    expect(stats.pluginCount).toBe(2);
    expect(stats.totalStars).toBe(300);
    expect(stats.totalDownloads).toBe(1000);
  });
});
