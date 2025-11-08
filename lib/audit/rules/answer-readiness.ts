import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule, clampScore } from './helpers';

const PILLAR = 'Answer Readiness' as const;

export const evaluateAnswerReadiness = (signals: AuditSignals): RuleEvaluation[] => {
  const rules: RuleEvaluation[] = [];

  const faqScore = signals.faqHeadingCount > 0 ? 6 : 0;
  rules.push(
    buildRule({
      id: 'answer_faq_visible',
      pillar: PILLAR,
      title: 'FAQ/Q&A sections visible',
      max: 6,
      score: faqScore,
      passed: faqScore === 6,
      findingId: faqScore === 6 ? undefined : 'faq_missing',
      evidence: faqScore === 6 ? `${signals.faqHeadingCount} FAQ headings found.` : 'No FAQ headings detected.'
    })
  );

  const tldrScore = signals.tlDrNearTop ? 6 : 0;
  rules.push(
    buildRule({
      id: 'answer_tldr',
      pillar: PILLAR,
      title: 'TL;DR or key takeaway near top',
      max: 6,
      score: tldrScore,
      passed: tldrScore === 6,
      findingId: tldrScore === 6 ? undefined : 'tldr_missing'
    })
  );

  const claimEvidenceScore = clampScore(signals.claimEvidenceBlocks * 3.5, 7);
  rules.push(
    buildRule({
      id: 'answer_claim_evidence',
      pillar: PILLAR,
      title: 'Claim → evidence blocks',
      max: 7,
      score: claimEvidenceScore,
      passed: signals.claimEvidenceBlocks >= 2,
      findingId: signals.claimEvidenceBlocks >= 2 ? undefined : 'claim_evidence_gap',
      evidence: `${signals.claimEvidenceBlocks} block(s) detected.`
    })
  );

  const claimCitationScore = clampScore(signals.claimCitationPairs * 2, 6);
  rules.push(
    buildRule({
      id: 'answer_claim_citation',
      pillar: PILLAR,
      title: 'Claim + citation proximity',
      max: 6,
      score: claimCitationScore,
      passed: signals.claimCitationPairs >= 2,
      findingId: signals.claimCitationPairs >= 2 ? undefined : 'claim_no_citation',
      evidence: `${signals.claimCitationPairs} paragraphs with citations.`
    })
  );

  return rules;
};
