import { describe, expect, it } from 'vitest';
import { compactHistoryPoint } from '../../src/lib/scoring';
import { splitScoreHistory } from '../../src/lib/score-history';
import { makeScored, NOW } from './helpers';

const point = compactHistoryPoint(makeScored(), NOW.toISOString());
describe('score method boundaries', () => {
  it('keeps old and new points but never connects A → B → A across a method change', () => {
    const points = ['1.1.0', '1.1.0', '2.0.0', '1.1.0'].map((methodVersion, index) => ({
      ...point, methodVersion, t: new Date(NOW.getTime() + index * 3600000).toISOString(),
      maintenance: 10 + index, popularity: 20 + index,
    }));
    const segments = splitScoreHistory(points);
    expect(segments.map(item => item.methodVersion)).toEqual(['1.1.0', '2.0.0', '1.1.0']);
    expect(segments.map(item => item.maintenance)).toEqual([
      [10, 11, null, null], [null, null, 12, null], [null, null, null, 13],
    ]);
    expect(segments.map(item => item.popularity)).toEqual([
      [20, 21, null, null], [null, null, 22, null], [null, null, null, 23],
    ]);
    expect(points.map(item => item.methodVersion)).toEqual(['1.1.0', '1.1.0', '2.0.0', '1.1.0']);
  });
  it('retains genuine zero values and null gaps within the same method', () => {
    const segments = splitScoreHistory([
      { ...point, maintenance: 0, popularity: null },
      { ...point, maintenance: null, popularity: 0 },
      { ...point, maintenance: 50, popularity: 60 },
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0].maintenance).toEqual([0, null, 50]);
    expect(segments[0].popularity).toEqual([null, 0, 60]);
  });
  it('handles empty history and preserves an isolated old point', () => {
    expect(splitScoreHistory([])).toEqual([]);
    const segments = splitScoreHistory([{ ...point, methodVersion: '1.1.0' }]);
    expect(segments).toHaveLength(1);
    expect(segments[0].startIndex).toBe(0);
    expect(segments[0].endIndex).toBe(0);
    expect(segments[0].maintenance).toEqual([point.maintenance]);
  });
});
