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

  it('preserves the commit-only evidence after renormalizing the remaining design weights', () => {
    const seed = makeSeed({
      openIssues: 0,
      issuesOpened90d: 0,
      prsOpened90d: 0,
      releaseDaysAgo: null,
      lastCommitDaysAgo: 7,
    });
    const score = maintenanceScore(seed, NOW);
    expect(score.coverage).toBe(0.5);
    expect(score.status).toBe('scored');
  });

  it('does not count open/new Issue backlog twice or alter a score only because openNow changes', () => {
    const busy = makeSeed({ issuesOpened90d: 10, issuesClosed90d: 8, openIssues: 8 });
    const quiet = makeSeed({ issuesOpened90d: 10, issuesClosed90d: 8, openIssues: 2 });
    const a = maintenanceScore(busy, NOW), b = maintenanceScore(quiet, NOW);
    expect(a.components.map(component => component.key)).not.toContain('issueBacklog');
    expect(a.score).toBe(b.score);
    expect(a.components.reduce((sum, component) => sum + component.weight, 0)).toBeCloseTo(1);
    [30 / 90, 15 / 90, 20 / 90, 15 / 90, 10 / 90].forEach((weight, index) => expect(a.components[index].weight).toBeCloseTo(weight));
    expect(a.methodVersion).toBe('2.0.0');
  });

  it.each([1, 4, 5, 20])('keeps %i Issue observations and reduces the effective evidence below five', (sample) => {
    const seed = makeSeed({ issuesOpened90d: sample, issuesClosed90d: 0, openIssues: sample });
    const score = maintenanceScore(seed, NOW);
    const component = score.components.find(item => item.key === 'issueHandling')!;
    expect(component.sampleSize).toBe(sample);
    expect(component.rawValue).toBe(0);
    expect(component.included).toBe(true);
    expect(score.coverage).toBeCloseTo(Math.round((70 / 90 + 20 / 90 * Math.min(1, sample / 5)) * 100) / 100);
    if (sample < 5) expect(component.effectiveWeight).toBeLessThan(component.weight);
  });

  it('does not score a truncated Issue ratio, while retaining its raw count', () => {
    const seed = makeSeed({ issuesOpened90d: 20, issuesClosed90d: 0, openIssues: 20 });
    seed.github.issues.truncated = true;
    const issue = maintenanceScore(seed, NOW).components.find(item => item.key === 'issueHandling')!;
    expect(issue.sampleSize).toBe(20);
    expect(issue.included).toBe(false);
    expect(issue.effectiveWeight).toBe(0);
  });

  it('keeps a truncated commit count as a scored lower bound', () => {
    const seed = makeSeed({
      commits30d: 500,
      commits30dTruncated: true,
      missingAvailability: ['commits'],
    });
    const score = maintenanceScore(seed, NOW);
    const cadence = score.components.find((component) => component.key === 'commitCadence')!;
    expect(cadence.included).toBe(true);
    expect(cadence.normalized).toBe(100);
    expect(cadence.rawLabel).toContain('+');
  });
});

describe('risk assessment', () => {
  it('keeps risk unknown when OSV matching is unavailable', () => {
    const score = riskAssessment(makeSeed({ securityStatus: 'unavailable' }), NOW);
    expect(score.level).toBe('unknown');
    expect(score.label).toBe('信息待补充');
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
    expect(score.label).toBe('暂无额外提醒');
    expect(score.limitations.join(' ')).toContain('不构成安全审计');
  });

  it.each([1, 4])('does not escalate a %i-Issue sample based on its ratio', (sample) => {
    const result = riskAssessment(makeSeed({ issuesOpened90d: sample, issuesClosed90d: 0, openIssues: sample }), NOW);
    expect(result.flags.some(flag => flag.code.startsWith('open-issues-'))).toBe(false);
    expect(result.level).toBe('low');
  });

  it.each([5, 20])('allows a complete %i-Issue sample to produce a ratio reminder', (sample) => {
    const result = riskAssessment(makeSeed({ issuesOpened90d: sample, issuesClosed90d: 0, openIssues: sample }), NOW);
    expect(result.flags.map(flag => flag.code)).toContain('open-issues-high');
  });

  it('requires both the new-Issue sample and the number currently open to be at least five', () => {
    for (const [opened, open] of [[4, 100], [20, 4]]) {
      const result = riskAssessment(makeSeed({ issuesOpened90d: opened, issuesClosed90d: 0, openIssues: open }), NOW);
      expect(result.flags.some(flag => flag.code.startsWith('open-issues-'))).toBe(false);
    }
    const medium = riskAssessment(makeSeed({ issuesOpened90d: 10, issuesClosed90d: 5, openIssues: 5 }), NOW);
    expect(medium.flags.map(flag => flag.code)).toContain('open-issues-medium');
  });

  it('does not infer a ratio when no new Issues exist', () => {
    const result = riskAssessment(makeSeed({ issuesOpened90d: 0, issuesClosed90d: 0, openIssues: 100 }), NOW);
    expect(result.flags.some(flag => flag.code.startsWith('open-issues-'))).toBe(false);
    const score = maintenanceScore(makeSeed({ issuesOpened90d: 0, issuesClosed90d: 0 }), NOW);
    expect(score.components.find(item => item.key === 'issueHandling')!.included).toBe(false);
  });

  it.each(['truncated', 'openTruncated'] as const)('does not infer proportion-based reminders from %s Issue results', (field) => {
    const seed = makeSeed({ issuesOpened90d: 20, issuesClosed90d: 0, openIssues: 20 });
    seed.github.issues[field] = true;
    const result = riskAssessment(seed, NOW);
    expect(result.flags.some(flag => flag.code.startsWith('open-issues-'))).toBe(false);
    expect(result.level).toBe('low');
  });

  it('keeps an independently observed twenty long-open Issues alert even when current ratios are unusable', () => {
    const seed = makeSeed({ issuesOpened90d: 1, issuesClosed90d: 0, openIssues: 21, longOpen: 20 });
    seed.github.issues.truncated = true;
    const result = riskAssessment(seed, NOW);
    expect(result.flags.map(flag => flag.code)).toContain('issue-backlog-high');
    expect(result.level).toBe('high');
  });

  it('keeps archive and verified vulnerability evidence with a tiny Issue sample', () => {
    for (const seed of [
      makeSeed({ issuesOpened90d: 1, issuesClosed90d: 0, openIssues: 1, archived: true }),
      makeSeed({ issuesOpened90d: 1, issuesClosed90d: 0, openIssues: 1, securityVulns: [vulnerability('critical')] }),
    ]) {
      const result = riskAssessment(seed, NOW);
      expect(result.level).toBe('high');
      expect(result.flags.some(flag => flag.code === 'archived' || flag.code.startsWith('osv-OSV'))).toBe(true);
    }
  });

  it('flags a large open-issue backlog even for a repository younger than 90 days', () => {
    const score = riskAssessment(
      makeSeed({ issuesOpened90d: 20, issuesClosed90d: 5, openIssues: 100 }),
      NOW,
    );
    expect(score.level).toBe('high');
    expect(score.flags.map((flag) => flag.code)).toContain('open-issues-high');
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

  it('does not place a verified npm package with missing downloads into a quadrant', () => {
    const seed = makeSeed({ npmStatus: 'verified', downloads30d: null });
    const [plugin] = scorePlugins([seed], NOW);
    expect(plugin.npm.status).toBe('verified');
    expect(plugin.npm.downloads30d).toBeNull();
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
