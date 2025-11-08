import { nanoid } from 'nanoid';

import { buildAuditContext } from './pipeline';
import { scoreAuditContext } from './score';
import { maybeGenerateFaqArtifact } from './faq';
import { persistRun } from './run-store';
import type { AuditResult } from './types';

export const runGeoAudit = async (url: string): Promise<AuditResult> => {
  const runId = nanoid();
  const context = await buildAuditContext(url, runId);
  const scored = scoreAuditContext(context);
  const result: AuditResult = {
    id: runId,
    ...scored,
    generatedArtifacts: {}
  };

  if (scored.findings.some(f => f.id === 'faq_missing')) {
    const faqArtifact = maybeGenerateFaqArtifact(context);
    if (faqArtifact) {
      result.generatedArtifacts = { faqPage: faqArtifact };
    }
  }

  console.info(
    '[geo-audit]',
    JSON.stringify({
      runId,
      url,
      bytes: context.dual.base.bytes,
      ttfbMs: context.dual.base.ttfbMs,
      score: result.geoScore,
      errors: context.dual.js.consoleErrors.length
    })
  );

  await persistRun(result);
  return result;
};

export const generateFaqOnly = async (url: string) => {
  const runId = nanoid();
  const context = await buildAuditContext(url, runId);
  const artifact = maybeGenerateFaqArtifact(context);
  return artifact ?? null;
};
