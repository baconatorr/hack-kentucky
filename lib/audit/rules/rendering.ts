import type { AuditSignals, RuleEvaluation } from '../types';
import { buildRule, clampScore } from './helpers';

const PILLAR = 'Rendering & Indexability' as const;

export const evaluateRendering = (signals: AuditSignals): RuleEvaluation[] => {
  const rules: RuleEvaluation[] = [];

  const textRatioScore =
    signals.textRatioNoJs >= 0.6 ? 8 : clampScore(signals.textRatioNoJs * 8, 8);
  rules.push(
    buildRule({
      id: 'render_text_ratio',
      pillar: PILLAR,
      title: '≥60% of text in no-JS HTML',
      max: 8,
      score: textRatioScore,
      passed: signals.textRatioNoJs >= 0.6,
      findingId: signals.textRatioNoJs >= 0.6 ? undefined : 'text_ratio_low',
      evidence: `text_ratio_noJS=${signals.textRatioNoJs}`
    })
  );

  let canonicalScore = 0;
  let canonicalFinding: string | undefined;
  if (signals.canonicalMatchesHost) {
    canonicalScore = 4;
  } else if (signals.canonicalExists) {
    canonicalScore = 2;
    canonicalFinding = 'canonical_conflict';
  } else {
    canonicalFinding = 'canonical_conflict';
  }

  rules.push(
    buildRule({
      id: 'render_canonical',
      pillar: PILLAR,
      title: 'Canonical matches live URL',
      max: 4,
      score: canonicalScore,
      passed: canonicalScore === 4,
      findingId: canonicalFinding,
      evidence: signals.canonical || 'Not set'
    })
  );

  let sitemapScore = 0;
  let sitemapFinding: string | undefined;
  if (!signals.sitemapUrl) {
    sitemapScore = 0;
    sitemapFinding = 'sitemap_missing';
  } else if (signals.sitemapFreshWithin365) {
    sitemapScore = 4;
  } else {
    sitemapScore = 3;
    sitemapFinding = 'sitemap_stale';
  }

  rules.push(
    buildRule({
      id: 'render_sitemap',
      pillar: PILLAR,
      title: 'Sitemap discoverable',
      max: 4,
      score: sitemapScore,
      passed: sitemapScore === 4,
      findingId: sitemapFinding,
      evidence: signals.sitemapUrl
    })
  );

  const robotsScore = signals.robotsAllow && !signals.metaNoindex ? 4 : signals.robotsAllow ? 2 : 0;
  rules.push(
    buildRule({
      id: 'render_robots',
      pillar: PILLAR,
      title: 'Robots.txt + meta robots allow indexing',
      max: 4,
      score: robotsScore,
      passed: robotsScore === 4,
      findingId: robotsScore === 4 ? undefined : 'robots_blocking',
      evidence: signals.metaNoindex ? 'meta robots=noindex' : signals.robotsAllow ? 'Robots allow' : 'Robots disallow'
    })
  );

  return rules;
};
