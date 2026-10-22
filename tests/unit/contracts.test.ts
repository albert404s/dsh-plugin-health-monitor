import { describe, expect, it } from 'vitest';
import { parseLatest, parseHistory, pluginSchema } from '../../src/lib/contracts';
import { compareScores, comparisonText } from '../../src/lib/comparison';
import { computeStats, scorePlugins, compactHistoryPoint } from '../../src/lib/scoring';
import { makeSeed, NOW } from './helpers';
import type { LatestData } from '../../src/lib/types';

function latest(): LatestData {
  const plugins = scorePlugins([makeSeed({id:'a'}),makeSeed({id:'b'})], NOW);
  const time = NOW.toISOString();
  return {schemaVersion:1,runId:'test',generatedAt:time,lastAttemptAt:time,lastSuccessAt:time,sources:{github:{status:'ok',fetchedAt:time},npm:{status:'ok',fetchedAt:time},osv:{status:'ok',fetchedAt:time}},stats:computeStats(plugins),plugins};
}
describe('runtime data contracts', () => {
  it('isolates a broken record and recalculates visible totals', () => {
    const input = latest(); input.plugins[0].github.stars = -1;
    const result = parseLatest(input);
    expect(result.data.plugins.map(p=>p.id)).toEqual(['b']);
    expect(result.data.stats.pluginCount).toBe(1);
    expect(result.warnings.join()).toContain('已隔离');
  });
  it('retains the same plugin previous record, with its original time, on a bad refresh', () => {
    const previous = latest(); const input = structuredClone(previous);
    input.plugins[0].github.stars = Number.NaN;
    const result = parseLatest(input, previous);
    expect(result.data.plugins[0].github.stars).toBe(previous.plugins[0].github.stars);
    expect(result.data.plugins[0].dataStatus).toBe('stale');
    expect(result.data.plugins[0].lastUpdatedAt).toBe(previous.plugins[0].lastUpdatedAt);
  });
  it('rejects bad core metadata, negative/fractional counts and impossible dates while retaining large counts', () => {
    expect(()=>parseLatest({...latest(),sources:null})).toThrow('核心数据');
    const plugin = latest().plugins[0];
    plugin.github.stars = 5_000_000_000;
    expect(pluginSchema.safeParse(plugin).success).toBe(true);
    plugin.github.commits30d = .5;
    expect(pluginSchema.safeParse(plugin).success).toBe(false);
    plugin.github.commits30d = 3; plugin.npm.daily = [{date:'2026-02-30',downloads:1}];
    expect(pluginSchema.safeParse(plugin).success).toBe(false);
  });
  it('does not double-count duplicate identities', () => {
    const input = latest(); input.plugins.push(structuredClone(input.plugins[0]));
    const result = parseLatest(input);
    expect(result.data.plugins).toHaveLength(2);
    expect(result.warnings.join()).toContain('重复');
  });
  it('keeps valid history from other plugins and discards conflicting snapshots', () => {
    const input = latest(); const first = compactHistoryPoint(input.plugins[0], NOW.toISOString());
    const second = {...first,t:new Date(NOW.getTime()+3600000).toISOString()};
    const result = parseHistory({schemaVersion:1,updatedAt:second.t,retentionDays:90,plugins:{a:[first,{...first,stars:first.stars+1},second],b:'bad',c:[first]}});
    expect(result.data.plugins.a).toEqual([second]);
    expect(result.data.plugins.c).toEqual([first]);
    expect(result.data.plugins.b).toBeUndefined();
    expect(result.warnings).toHaveLength(2);
  });
});
describe('score comparisons', () => {
  it('only computes a difference for the same method, included components and effective weights', () => {
    const [a,b] = latest().plugins; expect(compareScores(a.scores.maintenance,b.scores.maintenance).comparable).toBe(true);
    b.scores.maintenance.methodVersion='legacy-different-method';
    expect(comparisonText(a,b,'maintenance')).toContain('方法版本不同');
    b.scores.maintenance.methodVersion=a.scores.maintenance.methodVersion;
    b.scores.maintenance.components[0].effectiveWeight+=.01;
    expect(comparisonText(a,b,'maintenance')).toContain('有效权重不同');
    b.scores.maintenance.components[0].included=false;
    expect(comparisonText(a,b,'maintenance')).toContain('参与分项不同');
  });
  it('does not compare missing or stale scores', () => {
    const [a,b] = latest().plugins;
    b.scores.maintenance.score=null; b.scores.maintenance.status='insufficient';
    expect(comparisonText(a,b,'maintenance')).toContain('信息不足');
    b.dataStatus='stale'; expect(comparisonText(a,b,'popularity')).toContain('采集时间不同');
  });
});
