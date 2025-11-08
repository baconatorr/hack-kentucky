import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule } from './helpers';

const PILLAR = 'Entity Clarity' as const;

export const evaluateEntityClarity = (signals: AuditSignals): RuleEvaluation[] => {
  const rules: RuleEvaluation[] = [];

  const entityScore = signals.organizationSchema && signals.personOrProductSchema ? 4 : signals.organizationSchema ? 2 : 1;
  rules.push(
    buildRule({
      id: 'entity_schema_pairs',
      pillar: PILLAR,
      title: 'Organization + Person/Product schema',
      max: 4,
      score: entityScore,
      passed: signals.organizationSchema && signals.personOrProductSchema,
      findingId: signals.organizationSchema && signals.personOrProductSchema ? undefined : 'entity_schema_missing'
    })
  );

  const nameScore = signals.titleMatchesHeading ? 3 : 1;
  rules.push(
    buildRule({
      id: 'entity_name_consistency',
      pillar: PILLAR,
      title: 'Consistent H1/title naming',
      max: 3,
      score: nameScore,
      passed: signals.titleMatchesHeading,
      findingId: signals.titleMatchesHeading ? undefined : 'name_inconsistent'
    })
  );

  const sameAsScore = signals.sameAsCount >= 2 ? 3 : signals.sameAsCount > 0 ? 1 : 0;
  rules.push(
    buildRule({
      id: 'entity_sameas',
      pillar: PILLAR,
      title: '`sameAs` authority links',
      max: 3,
      score: sameAsScore,
      passed: signals.sameAsCount >= 2,
      findingId: signals.sameAsCount >= 2 ? undefined : 'sameas_missing',
      evidence: `${signals.sameAsCount} sameAs link(s).`
    })
  );

  return rules;
};
