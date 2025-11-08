import { format } from 'date-fns';

import type { AuditContext, FaqArtifact } from './types';

const normalizeQuestion = (q: string) => {
  const trimmed = q.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (/[?]$/.test(trimmed)) return trimmed;
  return `${trimmed}?`;
};

const truncateWords = (text: string, maxWords = 120) => {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
};

const buildQaPairs = (ctx: AuditContext) => {
  const candidates = ctx.dual.js.headings
    .filter(h => /\b(what|why|how|when|where|faq|question)\b/i.test(h))
    .slice(0, 8);

  return candidates.map((heading, idx) => ({
    question: normalizeQuestion(heading),
    answer: truncateWords(
      ctx.dual.js.paragraphs[idx] || ctx.dual.base.paragraphs[idx] || 'Provide a concise answer sourced from on-page copy.'
    )
  }));
};

const recommendedFaqPath = (url: string) => {
  const parsed = new URL(url);
  const segments = parsed.pathname.split('/').filter(Boolean);
  const slug = segments.at(-1) ?? 'geo-audit';
  return `/${slug}/faq`;
};

export const maybeGenerateFaqArtifact = (ctx: AuditContext): FaqArtifact | undefined => {
  const qaPairs = buildQaPairs(ctx);
  if (qaPairs.length < 3) return undefined;

  const date = new Date();
  const displayDate = format(date, 'MMMM d, yyyy');
  const iso = date.toISOString().split('T')[0];
  const provenance = `Generated from ${ctx.url} on ${displayDate}.`;

  const html = `<article class="prose prose-slate max-w-none">
  <p class="text-sm text-muted-foreground">${provenance}</p>
  ${qaPairs
    .map(
      qa => `<section class="border-b border-border py-4">
    <h2 class="text-xl font-semibold">${qa.question}</h2>
    <p>${qa.answer}</p>
  </section>`
    )
    .join('\n')}
</article>`;

  const jsonld = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      dateModified: iso,
      mainEntity: qaPairs.map(qa => ({
        '@type': 'Question',
        name: qa.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: qa.answer
        }
      })),
      mainEntityOfPage: ctx.url,
      publisher: {
        '@type': 'Organization',
        name: new URL(ctx.url).hostname
      }
    },
    null,
    2
  );

  return {
    recommendedPath: recommendedFaqPath(ctx.url),
    html,
    jsonld,
    provenance
  };
};
