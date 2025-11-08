import { PILLAR_MAX } from './constants';
import { computeSignals } from './signals';
import { evaluateAnswerReadiness } from './rules/answer-readiness';
import { evaluateSchema } from './rules/schema';
import { evaluateRendering } from './rules/rendering';
import { evaluateEvidence } from './rules/evidence';
import { evaluateEntityClarity } from './rules/entity';
import { evaluatePenalties } from './rules/penalties';
import { buildFinding, buildTopFixes } from './suggestions';
import type { AuditContext, AuditResult, Finding, Pillar, PillarName, RuleEvaluation } from './types';

const INITIAL_PILLARS: Record<PillarName, { score: number; max: number }> = {
  'Answer Readiness': { score: 0, max: PILLAR_MAX['Answer Readiness'] },
  'Schema & Structured Data': { score: 0, max: PILLAR_MAX['Schema & Structured Data'] },
  'Rendering & Indexability': { score: 0, max: PILLAR_MAX['Rendering & Indexability'] },
  'Evidence Packaging': { score: 0, max: PILLAR_MAX['Evidence Packaging'] },
  'Entity Clarity': { score: 0, max: PILLAR_MAX['Entity Clarity'] },
  // No Freshness pillar
};

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));
const TOTAL_POSSIBLE = Object.values(PILLAR_MAX).reduce((sum, val) => sum + val, 0);

export const scoreAuditContext = (ctx: AuditContext): Omit<AuditResult, 'id'> => {
  const signals = computeSignals(ctx);
  const findings: Finding[] = [];
  const findingIds = new Set<string>();

  const recordFinding = (id: string) => {
    if (!id || findingIds.has(id)) return;
    findingIds.add(id);
    findings.push(buildFinding(id, ctx));
  };

  const pillarScores: Record<PillarName, { score: number; max: number }> = {
    'Answer Readiness': { ...INITIAL_PILLARS['Answer Readiness'] },
    'Schema & Structured Data': { ...INITIAL_PILLARS['Schema & Structured Data'] },
    'Rendering & Indexability': { ...INITIAL_PILLARS['Rendering & Indexability'] },
    'Evidence Packaging': { ...INITIAL_PILLARS['Evidence Packaging'] },
    'Entity Clarity': { ...INITIAL_PILLARS['Entity Clarity'] },
    // No Freshness pillar
  };

  const ruleEvaluations: RuleEvaluation[] = [
    ...evaluateAnswerReadiness(signals),
    ...evaluateSchema(signals),
    ...evaluateRendering(signals),
    ...evaluateEvidence(signals),
    ...evaluateEntityClarity(signals)
  ];

  for (const rule of ruleEvaluations) {
    if (pillarScores[rule.pillar]) {
      pillarScores[rule.pillar].score = clamp(
        pillarScores[rule.pillar].score + rule.score,
        pillarScores[rule.pillar].max
      );
    }
    if (!rule.passed && rule.findingId) {
      recordFinding(rule.findingId);
    }
  }

  const { total: redFlagPenalty, rules: penaltyRules } = evaluatePenalties(signals);
  penaltyRules.forEach(rule => {
    if (pillarScores[rule.pillar as PillarName]) {
      // penalties should not change pillar totals, so skip aggregation
    }
    if (rule.findingId) {
      recordFinding(rule.findingId);
    }
  });

  const baseScore = (Object.values(pillarScores) as { score: number; max: number }[]).reduce(
    (sum, pillar) => sum + clamp(pillar.score, pillar.max),
    0
  );
  const normalizedScore = (baseScore / TOTAL_POSSIBLE) * 100;
  const geoScore = Math.max(0, Math.min(100, normalizedScore - redFlagPenalty));

  const topFixes = buildTopFixes(Array.from(findingIds), ctx);

  const pillars: Pillar[] = (Object.entries(pillarScores) as [PillarName, { score: number; max: number }][]).map(
    ([name, data]) => ({
      name,
      score: Number(clamp(data.score, data.max).toFixed(2)),
      max: data.max
    })
  );

  const evidence = {
    textRatioNoJS: signals.textRatioNoJs,
    noJSHeadings: ctx.dual.base.headings,
    jsHeadings: ctx.dual.js.headings,
    missingHeadings: ctx.dual.missingHeadings,
    jsonLdTypes: signals.jsonLdTypes,
    consoleErrors: ctx.dual.js.consoleErrors,
    screenshotDiffs: ctx.dual.screenshots,
    canonical: ctx.dual.js.canonicalUrl,
    sitemap: ctx.dual.sitemap?.url,
    robots: ctx.dual.robotsTxt?.url,
    updatedOnText: ctx.dual.js.updatedOnSnippet,
    sitemapLastmod: ctx.dual.sitemap?.lastmod
  };

  const scoreTrace = [...ruleEvaluations, ...penaltyRules];

  return {
    url: ctx.url,
    geoScore,
    pillars,
    findings,
    topFixes,
    evidence,
    scoreTrace
  };
};
