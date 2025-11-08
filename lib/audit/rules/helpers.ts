import type { PillarName, RuleEvaluation } from '../types';

export const clampScore = (value: number, max: number) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, max));
};

type BuildRuleInput = {
  id: string;
  pillar: PillarName;
  title: string;
  description?: string;
  max: number;
  score: number;
  passed: boolean;
  findingId?: string;
  evidence?: string;
};

export const buildRule = ({
  id,
  pillar,
  title,
  description,
  max,
  score,
  passed,
  findingId,
  evidence
}: BuildRuleInput): RuleEvaluation => ({
  id,
  pillar,
  title,
  description,
  max,
  score: Number(score.toFixed(2)),
  passed,
  findingId,
  evidence
});
