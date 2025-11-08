import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule, clampScore } from './helpers';

const PILLAR = 'Evidence Packaging' as const;

export const evaluateEvidence = (signals: AuditSignals): RuleEvaluation[] => {
  const rules: RuleEvaluation[] = [];

  const datesScore = signals.inlineDateCount > 0 ? 3 : 0;
  rules.push(
    buildRule({
      id: 'evidence_inline_dates',
      pillar: PILLAR,
      title: 'Inline “Updated on” or factual dates',
      max: 3,
      score: datesScore,
      passed: datesScore === 3,
      findingId: datesScore === 3 ? undefined : 'inline_dates_missing'
    })
  );

  const citationBoostUnits = Math.min(3, Math.floor(signals.referenceCitationCount / 5));
  const effectiveLinkUnits = signals.externalLinkCount + citationBoostUnits;
  const outboundScore = clampScore(effectiveLinkUnits * 2, 5);
  rules.push(
    buildRule({
      id: 'evidence_outbound',
      pillar: PILLAR,
      title: 'Primary-source outbound links',
      max: 5,
      score: outboundScore,
      passed: signals.externalLinkCount >= 2 || citationBoostUnits >= 2,
      findingId: signals.externalLinkCount >= 2 || citationBoostUnits >= 2 ? undefined : 'outbound_links_missing',
      evidence: `${signals.externalLinkCount} external link(s), ${signals.referenceCitationCount} citation reference(s).`
    })
  );

  const altScore =
    !signals.hasImages || signals.altCoverage >= 0.8 ? 4 : signals.altCoverage >= 0.5 ? 3 : 2;
  rules.push(
    buildRule({
      id: 'evidence_alt_text',
      pillar: PILLAR,
      title: 'Descriptive alt text',
      max: 4,
      score: altScore,
      passed: !signals.hasImages || signals.altCoverage >= 0.8,
      findingId: !signals.hasImages || signals.altCoverage >= 0.8 ? undefined : 'alt_text_missing',
      evidence: signals.hasImages ? `alt coverage ${(signals.altCoverage * 100).toFixed(0)}%` : 'No images'
    })
  );

  const dataScore = signals.tableCount > 0 || signals.datasetHintCount > 0 ? 3 : 0;
  rules.push(
    buildRule({
      id: 'evidence_data_table',
      pillar: PILLAR,
      title: 'Tables or downloadable datasets',
      max: 3,
      score: dataScore,
      passed: dataScore === 3,
      findingId: dataScore === 3 ? undefined : 'table_missing'
    })
  );

  return rules;
};
