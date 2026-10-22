import type { HistoryPoint } from './types';

export interface ScoreHistorySegment {
  methodVersion: string;
  startIndex: number;
  endIndex: number;
  maintenance: Array<number | null>;
  popularity: Array<number | null>;
}

/**
 * A line belongs to a contiguous method-version run, not just a version name.
 * In A → B → A, the two A runs must remain separate even though the label repeats.
 * Empty slots break the line without dropping any old snapshot or inventing data.
 */
export function splitScoreHistory(points: readonly HistoryPoint[]): ScoreHistorySegment[] {
  const segments: ScoreHistorySegment[] = [];
  for (const [index, point] of points.entries()) {
    let segment = segments[segments.length - 1];
    if (!segment || segment.methodVersion !== point.methodVersion) {
      segment = {
        methodVersion: point.methodVersion,
        startIndex: index,
        endIndex: index,
        maintenance: Array(points.length).fill(null),
        popularity: Array(points.length).fill(null),
      };
      segments.push(segment);
    }
    segment.endIndex = index;
    segment.maintenance[index] = point.maintenance;
    segment.popularity[index] = point.popularity;
  }
  return segments;
}
