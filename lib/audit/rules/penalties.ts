import { RED_FLAG_PENALTY } from '../constants';
import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule } from './helpers';

export const evaluatePenalties = (
  signals: AuditSignals
): { total: number; rules: RuleEvaluation[] } => {
  const rules: RuleEvaluation[] = [];
  let total = 0;

  if (signals.textRatioNoJs < 0.5 && signals.baseHeadingCount <= 1) {
    total += RED_FLAG_PENALTY;
    rules.push(
      buildRule({
        id: 'penalty_text_ratio',
        pillar: 'Rendering & Indexability',
        title: 'Red flag: body text only client-rendered',
        max: 0,
        score: -RED_FLAG_PENALTY,
        passed: false,
        findingId: 'text_ratio_low',
        evidence: `text_ratio_noJS=${signals.textRatioNoJs}`
      })
    );
  }

  if (signals.metaNoindex) {
    total += RED_FLAG_PENALTY;
    rules.push(
      buildRule({
        id: 'penalty_noindex',
        pillar: 'Rendering & Indexability',
        title: 'Red flag: Meta robots noindex on canonical content',
        max: 0,
        score: -RED_FLAG_PENALTY,
        passed: false,
        findingId: 'robots_blocking'
      })
    );
  } else if (signals.canonicalExists && !signals.canonicalMatchesHost) {
    total += RED_FLAG_PENALTY;
    rules.push(
      buildRule({
        id: 'penalty_canonical',
        pillar: 'Rendering & Indexability',
        title: 'Red flag: Canonical conflicts with live URL',
        max: 0,
        score: -RED_FLAG_PENALTY,
        passed: false,
        findingId: 'canonical_conflict',
        evidence: signals.canonical
      })
    );
  }

  // Cap penalties at 20 per rubric.
  const cap = RED_FLAG_PENALTY * 2;
  if (total > cap) {
    const difference = total - cap;
    total = cap;
    if (difference > 0 && rules.length > 0) {
      const lastRule = rules[rules.length - 1];
      lastRule.score += difference;
    }
  }

  return { total, rules };
};
