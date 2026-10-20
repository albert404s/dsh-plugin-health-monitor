import { describe, expect, it } from 'vitest';
import { calendarWindowSum, isCount, normalizeDaily, normalizeGithubRepository } from '../../src/lib/data-quality';
import { findPlatformGapDates, movingAverage, toDisplaySeries } from '../../src/lib/downloads';
import { cleanSeedRecords, applyNpmGapGuard } from '../../scripts/lib/clean';
import { makeSeed, NOW } from './helpers';
import { scorePlugins } from '../../src/lib/scoring';

describe('calendar cleaning',()=>{
  it('deduplicates equal observations, isolates conflicts and never sums duplicates',()=>{
    const result=normalizeDaily([{date:'2026-10-10',downloads:10},{date:'2026-10-10',downloads:10},{date:'2026-10-11',downloads:10},{date:'2026-10-11',downloads:12},{date:'2026-10-12',downloads:0}]);
    expect(result.daily).toEqual([{date:'2026-10-10',downloads:10},{date:'2026-10-12',downloads:0}]);
    expect(result.conflictDates).toEqual(['2026-10-11']);
    expect(calendarWindowSum(result.daily,'2026-10-12',3)).toBeNull();
  });
  it('rejects negative, fractional, nonfinite and invalid/outside-window observations without coercing to zero',()=>{
    const result=normalizeDaily([{date:'2026-02-30',downloads:2},{date:'2026-10-10',downloads:-1},{date:'2026-10-10',downloads:.5},{date:'2026-10-11',downloads:NaN},{date:'2026-10-12',downloads:Infinity},{date:'2026-10-13',downloads:4},{date:'2026-10-10',downloads:5_000_000_000}],{end:'2026-10-12'});
    expect(result.invalidCount).toBe(6);
    expect(result.daily).toEqual([{date:'2026-10-10',downloads:5_000_000_000}]);
    expect(isCount('0')).toBe(false);
  });
  it('retains a positive observation on a suspected platform gap date',()=>{
    const values=[0,0,0,0,900].map(downloads=>({status:'verified' as const,daily:[{date:'2026-10-10',downloads}]}));
    const gaps=findPlatformGapDates(values);
    expect(gaps.has('2026-10-10')).toBe(true);
    expect(toDisplaySeries(values[4].daily,gaps)[0].downloads).toBe(900);
    expect(toDisplaySeries(values[0].daily,gaps)[0].downloads).toBeNull();
  });
  it('prevents duplicate records from inflating platform package coverage',()=>{
    const daily=Array.from({length:6},()=>({date:'2026-10-10',downloads:0}));
    expect(findPlatformGapDates([{status:'verified',daily}]).size).toBe(0);
  });
  it('breaks calendar averages for missing and conflicting days',()=>{
    const daily=[{date:'2026-10-10',downloads:10},{date:'2026-10-12',downloads:10}];
    const series=toDisplaySeries(daily,new Set());
    expect(series[1]).toEqual({date:'2026-10-11',downloads:null,missing:true});
    expect(movingAverage(series,3)[2]).toBeNull();
    expect(movingAverage([{date:'2026-10-10',downloads:10,missing:false},{date:'2026-10-12',downloads:10,missing:false}],2)[1]).toBeNull();
  });
});
describe('identity, seed cleaning and fallback',()=>{
  it('normalizes GitHub forms and rejects unrelated hosts and subpaths',()=>{
    for(const input of ['git+https://github.com/Owner/Repo.git#main','git@github.com:Owner/Repo.git','ssh://git@github.com/Owner/Repo','Owner/Repo','github:Owner/Repo'])expect(normalizeGithubRepository(input)).toBe('owner/repo');
    expect(normalizeGithubRepository('https://github.com.evil.test/owner/repo')).toBeNull();
    expect(normalizeGithubRepository('https://github.com/owner/repo/tree/main')).toBeNull();
  });
  it('degrades optional bad counts to missing while keeping repository evidence',()=>{
    const seed=makeSeed();seed.npm.downloads30d=-9;
    const result=cleanSeedRecords([seed],[],NOW);
    expect(result.records).toHaveLength(1);expect(result.records[0].npm.downloads30d).toBeNull();expect(result.records[0].availability.npm).toBe(false);expect(result.records[0].dataStatus).toBe('partial');
  });
  it('quarantines invalid required metrics and preserves same-identity previous data and time',()=>{
    const seed=makeSeed();const previous=scorePlugins([seed],NOW);seed.github.stars=-1;
    expect(cleanSeedRecords([seed],[],NOW).records).toHaveLength(0);
    const result=cleanSeedRecords([seed],previous,NOW).records[0];
    expect(result.dataStatus).toBe('stale');expect(result.github.stars).toBe(previous[0].github.stars);expect(result.lastUpdatedAt).toBe(previous[0].lastUpdatedAt);
  });
  it('rejects mismatched npm mapping and duplicate repository identities',()=>{
    const seed=makeSeed();seed.npm.repositoryUrl='https://github.com/another/repo';
    expect(cleanSeedRecords([seed],[],NOW).records).toHaveLength(0);
    const first=makeSeed();expect(cleanSeedRecords([first,structuredClone(first)],[],NOW).records).toHaveLength(1);
  });
  it('does not turn future commit timestamps into perfect recency scores',()=>{
    const seed=makeSeed();seed.github.lastCommitAt='2099-01-01T00:00:00.000Z';
    const record=cleanSeedRecords([seed],[],NOW).records[0];
    expect(record.github.lastCommitAt).toBeNull();expect(record.availability.commits).toBe(false);
  });
  it('suppresses weekly changes only in zero-valued packages affected by suspected gaps',()=>{
    const seeds=[0,0,0,0,20].map((downloads,index)=>{
      const seed=makeSeed({id:'p'+index});seed.npm.daily=[{date:'2026-10-19',downloads}];seed.npm.downloads7d=100;seed.npm.previous7d=50;return seed;
    });
    expect(applyNpmGapGuard(seeds)).toBe(4);
    expect(seeds[4].npm.downloads7d).toBe(100);expect(seeds[0].npm.downloads7d).toBeNull();
  });
});
