import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule } from './helpers';

const PILLAR = 'Schema & Structured Data' as const;

export const evaluateSchema = (signals: AuditSignals): RuleEvaluation[] => {
  const rules: RuleEvaluation[] = [];

  const jsonLdScore = signals.jsonLdCount > 0 ? 6 : 0;
  rules.push(
    buildRule({
      id: 'schema_jsonld',
      pillar: PILLAR,
      title: 'JSON-LD present',
      max: 6,
      score: jsonLdScore,
      passed: jsonLdScore === 6,
      findingId: jsonLdScore === 6 ? undefined : 'jsonld_missing',
      evidence: jsonLdScore === 6 ? `${signals.jsonLdCount} script(s)` : 'No JSON-LD detected.'
    })
  );

  const supportedScore = signals.supportedSchemaCount > 0 ? 8 : 0;
  rules.push(
    buildRule({
      id: 'schema_supported_types',
      pillar: PILLAR,
      title: 'Supported schema types (Article/FAQ/HowTo/Dataset)',
      max: 8,
      score: supportedScore,
      passed: supportedScore === 8,
      findingId: supportedScore === 8 ? undefined : 'jsonld_missing',
      evidence: `${signals.supportedSchemaCount} supported block(s).`
    })
  );

  const richPropsScore = signals.schemaHasRichProperties ? 6 : 0;
  rules.push(
    buildRule({
      id: 'schema_rich_properties',
      pillar: PILLAR,
      title: 'Non-trivial properties (author/dates/publisher/mainEntity)',
      max: 6,
      score: richPropsScore,
      passed: richPropsScore === 6,
      findingId: richPropsScore === 6 ? undefined : 'schema_properties_sparse'
    })
  );

  return rules;
};
