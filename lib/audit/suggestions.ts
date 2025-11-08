import { format } from 'date-fns';

import type { AuditContext, Finding, TopFix } from './types';

type SuggestionConfig = {
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  fixTitle: string;
  why: string;
  where: string;
  snippetHtml?: string;
  snippetJsonld?: string;
  snippetJs?: string;
};

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const formatDate = (date: Date) => format(date, 'MMMM d, yyyy');

const snippetTemplates = (ctx: AuditContext): Record<string, () => SuggestionConfig> => {
  const domain = getDomain(ctx.url);
  const title = ctx.dual.js.title || ctx.dual.base.title || domain;
  const today = new Date();
  const isoDate = today.toISOString().split('T')[0];
  const provenance = `${ctx.url} on ${formatDate(today)}`;
  const faqList = ctx.dual.js.headings
    .filter(h => /\bwhat|how|why|faq|when|where/i.test(h))
    .slice(0, 3)
    .map((heading, idx) => ({
      question: heading.replace(/[:?]+$/, '?'),
      answer: ctx.dual.js.paragraphs[idx] || 'Add a concise, evidence-backed answer in 80–120 words.'
    }));

  const faqItemsHtml = faqList
    .map(
      qa => `<details class="border border-zinc-200 rounded-lg p-4">
  <summary class="font-semibold">${qa.question}</summary>
  <p class="mt-2 text-sm leading-6">${qa.answer}</p>
</details>`
    )
    .join('\n');

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqList.map(qa => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer
      }
    })),
    mainEntityOfPage: ctx.url
  };

  return {
    faq_missing: () => ({
      impact: 'high',
      effort: 'low',
      fixTitle: 'Add visible FAQ with matching JSON-LD',
      why: 'No FAQ/Q&A headings detected, so the page cannot answer common queries directly.',
      where: "After the section that introduces the product's workflow.",
      snippetHtml: `<section aria-labelledby="faq-title" class="space-y-4">
  <h2 id="faq-title" class="text-2xl font-semibold">Frequently Asked Questions</h2>
  ${faqItemsHtml}
  <p class="text-sm text-muted-foreground">Generated from ${provenance}.</p>
</section>`,
      snippetJsonld: JSON.stringify(faqJsonLd, null, 2)
    }),
    tldr_missing: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Add TL;DR summary near the hero',
      why: 'No TL;DR or key takeaway statements were found within the first screenful.',
      where: 'Immediately after the hero paragraph.',
      snippetHtml: `<section class="rounded-lg border border-amber-200 bg-amber-50 p-4">
  <p class="text-sm font-semibold tracking-wide text-amber-900">TL;DR</p>
  <p class="text-base text-amber-900/90">
    {Replace with a 2-sentence summary that states the claim and the measurable outcome customers care about.}
  </p>
</section>`
    }),
    claim_evidence_gap: () => ({
      impact: 'high',
      effort: 'medium',
      fixTitle: 'Pair each claim with inline evidence',
      why: 'Paragraphs mention benefits without citing primary sources or data.',
      where: 'Within the first two body sections.',
      snippetHtml: `<p>
  <strong>Claim:</strong> Teams that ship weekly GEO audits improve answer surfaces within 2 sprints.
  <strong>Evidence:</strong> According to <a href="https://example.com/report-2025" target="_blank" rel="noopener">Forrester, 2025</a>,
  programs with structured audits saw a 31% lift in AI-ready snippets.
</p>`
    }),
    claim_no_citation: () => ({
      impact: 'high',
      effort: 'medium',
      fixTitle: 'Add citations next to bold claims',
      why: 'Claims are not followed by outbound, primary-source links.',
      where: 'Wherever metrics or rankings are listed.',
      snippetHtml: `<p>
  <strong>Claim:</strong> ${title} reduces hallucinated answers by 48%.
  <strong>Evidence:</strong> According to <a href="https://data.${domain}/geo-study.csv" target="_blank" rel="noopener">Internal Study, 2025</a>
  across 120 intents.
</p>`
    }),
    jsonld_missing: () => ({
      impact: 'high',
      effort: 'low',
      fixTitle: 'Add Article schema describing the page',
      why: 'No JSON-LD blocks were detected.',
      where: '<head>',
      snippetJsonld: JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          author: { '@type': 'Organization', name: domain },
          datePublished: isoDate,
          dateModified: isoDate,
          mainEntityOfPage: ctx.url,
          publisher: { '@type': 'Organization', name: domain }
        },
        null,
        2
      )
    }),
    schema_properties_sparse: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Expand schema with author, dates, publisher, and mainEntity',
      why: 'Schema is missing author/publisher/date properties required for rich results.',
      where: '<head>',
      snippetJsonld: JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          author: { '@type': 'Person', name: 'Please add editor name' },
          datePublished: isoDate,
          dateModified: isoDate,
          publisher: {
            '@type': 'Organization',
            name: domain,
            logo: { '@type': 'ImageObject', url: `https://${domain}/logo.png` }
          },
          mainEntityOfPage: ctx.url
        },
        null,
        2
      )
    }),
    text_ratio_low: () => ({
      impact: 'high',
      effort: 'medium',
      fixTitle: 'Server-render primary content to improve text_ratio_noJS',
      why: 'Most of the copy renders only after hydration, so crawlers miss it.',
      where: 'Page-level data fetching (Next.js).',
      snippetJs: `export async function getStaticProps() {
  const res = await fetch(\`\${process.env.CONTENT_API}/pages${new URL(ctx.url).pathname}\`);
  const page = await res.json();
  return {
    props: { page },
    revalidate: 3600
  };
}`
    }),
    canonical_conflict: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Set a canonical that matches the live URL',
      why: 'The canonical link points to a different host or is missing.',
      where: '<head>',
      snippetHtml: `<link rel="canonical" href="${ctx.url}" />`
    }),
    sitemap_missing: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Expose sitemap in robots.txt',
      why: 'No sitemap file was discovered via robots.txt or default locations.',
      where: 'https://'+domain+'/robots.txt',
      snippetHtml: `User-agent: *
Allow: /
Sitemap: https://${domain}/sitemap.xml`
    }),
    robots_blocking: () => ({
      impact: 'high',
      effort: 'low',
      fixTitle: 'Allow GEO crawler access',
      why: 'robots.txt disallows this path for generic user-agents.',
      where: `https://${domain}/robots.txt`,
      snippetHtml: `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
Sitemap: https://${domain}/sitemap.xml`
    }),
    inline_dates_missing: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Add inline updated-on dates',
      why: 'No inline dates were found near key claims.',
      where: 'Under the heading or within stat blocks.',
      snippetHtml: `<p>
  <time datetime="${isoDate}">Updated on ${formatDate(today)}</time> – GEO benchmarks refreshed monthly.
</p>`
    }),
    outbound_links_missing: () => ({
      impact: 'medium',
      effort: 'medium',
      fixTitle: 'Link to primary research for each stat',
      why: 'Fewer than 2 outbound citations were detected.',
      where: 'Where stats or methodologies are presented.',
      snippetHtml: `<p>
  <strong>Evidence:</strong> Based on <a href="https://research.${domain}/geo-trends-2025.pdf" target="_blank" rel="noopener">Geo Trends 2025</a>.
</p>`
    }),
    alt_text_missing: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Provide descriptive alt text on hero and chart images',
      why: 'Most images lack alt text, so assistive tech and crawlers miss the context.',
      where: 'Hero illustrations and data charts.',
      snippetHtml: `<figure>
  <img src="/images/geo-score.png" alt="Chart showing GEO score climbing from 42 to 78 in 4 weeks" />
  <figcaption>Weekly GEO score trend once audits were automated.</figcaption>
</figure>`
    }),
    table_missing: () => ({
      impact: 'medium',
      effort: 'medium',
      fixTitle: 'Publish structured table with downloadable CSV',
      why: 'No tables or data downloads detected despite metrics being referenced.',
      where: 'After the methodology section.',
      snippetHtml: `<table class="w-full text-sm">
  <caption>Weekly GEO score impact</caption>
  <thead>
    <tr><th>Week</th><th>Score</th><th>Primary Fix</th></tr>
  </thead>
  <tbody>
    <tr><td>1</td><td>42</td><td>Added TL;DR</td></tr>
    <tr><td>4</td><td>78</td><td>Shipped FAQ schema</td></tr>
  </tbody>
</table>`,
      snippetJsonld: `{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "Weekly GEO score impact",
  "description": "Key figures from ${title}.",
  "distribution": [
    {
      "@type": "DataDownload",
      "encodingFormat": "text/csv",
      "contentUrl": "${new URL(ctx.url).origin}/downloads/geo-score.csv"
    }
  ]
}`
    }),
    entity_schema_missing: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Declare Organization and Person entities',
      why: 'Schema lacks Organization/WebSite + Person/Product definitions.',
      where: '<head>',
      snippetJsonld: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${domain}",
  "url": "${new URL(ctx.url).origin}",
  "logo": "https://${domain}/logo.png",
  "sameAs": [
    "https://www.linkedin.com/company/${domain}",
    "https://twitter.com/${domain}"
  ]
}`
    }),
    name_inconsistent: () => ({
      impact: 'low',
      effort: 'low',
      fixTitle: 'Align H1, title, and schema names',
      why: 'The H1 text does not match the <title> and schema headline.',
      where: 'Hero heading and metadata.',
      snippetHtml: `<h1>${title}</h1>
<meta name="og:title" content="${title}" />`
    }),
    sameas_missing: () => ({
      impact: 'low',
      effort: 'low',
      fixTitle: 'Add sameAs references',
      why: 'Organization schema is missing sameAs links to public profiles.',
      where: 'Organization JSON-LD block.',
      snippetJsonld: `{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${domain}",
  "url": "${new URL(ctx.url).origin}",
  "sameAs": [
    "https://en.wikipedia.org/wiki/${domain}",
    "https://www.crunchbase.com/organization/${domain}"
  ]
}`
    }),
    sitemap_stale: () => ({
      impact: 'medium',
      effort: 'low',
      fixTitle: 'Refresh sitemap <lastmod> within 365 days',
      why: 'Sitemap lastmod is older than one year.',
      where: 'build pipeline that writes sitemap.xml',
      snippetJs: [
        "import { writeFileSync } from 'node:fs';",
        '',
        'const lastmod = new Date().toISOString().split("T")[0];',
        'const urls = [',
        `  { loc: '${ctx.url}', lastmod }`,
        '];',
        '',
        'const xmlBody = urls',
        '  .map(url => `<url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod></url>`)',
        "  .join('');",
        'const xml = [',
        `  '<?xml version="1.0" encoding="UTF-8"?>',`,
        `  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',`,
        '  xmlBody,',
        `  '</urlset>'`,
        "].join('\\n');",
        '',
        "writeFileSync('public/sitemap.xml', xml);"
      ].join('\n')
    })
  };
};

export const buildFinding = (id: string, ctx: AuditContext): Finding => {
  const builder = snippetTemplates(ctx)[id];
  if (!builder) {
    return {
      id,
      severity: 'low',
      fixTitle: 'Review recommendation',
      impact: 'low',
      effort: 'low',
      where: 'Page body',
      why: 'See audit output.'
    };
  }
  const data = builder();
  return {
    id,
    severity: data.impact === 'high' ? 'high' : data.impact === 'medium' ? 'medium' : 'low',
    fixTitle: data.fixTitle,
    impact: data.impact,
    effort: data.effort,
    where: data.where,
    why: data.why,
    snippetHtml: data.snippetHtml,
    snippetJsonld: data.snippetJsonld,
    snippetJs: data.snippetJs
  };
};

export const buildTopFixes = (findingIds: string[], ctx: AuditContext): TopFix[] => {
  const builders = snippetTemplates(ctx);
  return findingIds.slice(0, 5).map(id => {
    const data = builders[id]?.();
    return {
      id,
      impact: data?.impact ?? 'medium',
      effort: data?.effort ?? 'medium',
      why: data?.why ?? 'See audit finding.',
      where: data?.where ?? 'Refer to section cited in finding.',
      snippetHtml: data?.snippetHtml,
      snippetJsonld: data?.snippetJsonld,
      snippetJs: data?.snippetJs
    };
  });
};
