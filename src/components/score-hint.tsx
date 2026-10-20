import type { ReactNode } from 'react';
import type { PopularityScore } from '../lib/types';
import { QuietHint } from './quiet-hint';

export function ScoreHint({ score, children }: {
  score: Pick<PopularityScore, 'status' | 'confidence' | 'coverage'>;
  children: ReactNode;
}): JSX.Element {
  const evidence = score.status !== 'scored'
    ? '信息不足'
    : score.confidence === 'high' ? '依据较充分' : score.confidence === 'medium' ? '依据一般' : '依据较少';
  return <QuietHint className="orbit-score-evidence" text={evidence + ' · 评分依据覆盖 ' + Math.round(score.coverage * 100) + '%'}>
    {children}
  </QuietHint>;
}
