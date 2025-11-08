import * as cheerio from 'cheerio';
import crypto from 'node:crypto';

import type { RenderSnapshot } from './types';

const normalizeWhitespace = (text: string) =>
  text.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();

const truncate = (input: string, max = 320) => {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}…`;
};

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

const CLAIM_REGEX = /\bclaim\b/i;
const EVIDENCE_REGEX = /\bevidence\b/i;
const CITATION_REGEX = /\b(?:according to|source:?)\b/i;
const CITATION_KEYWORDS = /\b(according to|study|report|research|analysis|survey|data shows)\b/i;

const DATE_REGEX =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+\d{1,2},\s+\d{4})?\b|\b\d{4}\b/g;

const UPDATED_REGEX = /\bupdated (on|:)\b/i;

const isExternal = (href: string, baseHost: string) => {
  try {
    const candidate = new URL(href, baseHost.startsWith('http') ? baseHost : `https://${baseHost}`);
    return candidate.hostname !== new URL(baseHost).hostname;
  } catch {
    return false;
  }
};

const hashText = (text: string) =>
  crypto.createHash('sha1').update(text).digest('hex').slice(0, 12);

export const buildSnapshot = (html: string, url: string): RenderSnapshot => {
  const $ = cheerio.load(html);
  $('script,noscript,style').remove();

  const title = normalizeWhitespace($('title').first().text()) || normalizeWhitespace($('h1').first().text());
  const description = normalizeWhitespace($('meta[name="description"]').attr('content') || '');
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || undefined;

  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = normalizeWhitespace($(el).text());
    if (text) headings.push(text);
  });

  const paragraphsRaw: string[] = [];
  $('p').each((_, el) => {
    const text = normalizeWhitespace($(el).text());
    if (text) paragraphsRaw.push(text);
  });

  const paragraphs = paragraphsRaw.slice(0, 80).map(p => truncate(p));

  const paragraphWordCounts = paragraphs.map(p => (p ? p.split(/\s+/).length : 0));
  const paragraphHasCitation = paragraphsRaw.slice(0, 80).map((_, idx) => {
    const el = $('p').get(idx);
    if (!el) return false;
    const node = $(el);
    const externalAnchors = node
      .find('a[href]')
      .filter((__, link) => {
        const href = $(link).attr('href') || '';
        return /^https?:\/\//.test(href);
      }).length;
    const referenceSup = node.find('sup.reference').length;
    const internalCitationAnchors = node.find('a[href^="#cite"],a[href^="#ref"],a[href*="cite_note"]').length;
    return externalAnchors > 0 || referenceSup > 0 || internalCitationAnchors > 0;
  });

  const citationParagraphIndexes = new Set<number>();
  let claimCitationPairs = 0;
  paragraphsRaw.slice(0, 80).forEach((text, idx) => {
    if (!paragraphHasCitation[idx]) return;
    citationParagraphIndexes.add(idx);
    claimCitationPairs += 1;
    if (CLAIM_REGEX.test(text) || EVIDENCE_REGEX.test(text) || CITATION_REGEX.test(text) || CITATION_KEYWORDS.test(text)) {
      citationParagraphIndexes.add(idx);
    }
  });

  const claimEvidenceBlocks = citationParagraphIndexes.size;

  const inlineDates = unique(
    (paragraphsRaw.join(' ').match(DATE_REGEX) || []).map(token => token.trim()).slice(0, 10)
  );

  const images = $('img')
    .map((_, el) => {
      const src = $(el).attr('src') || '';
      const alt = normalizeWhitespace($(el).attr('alt') || '');
      if (!src) return null;
      return { src, alt };
    })
    .get()
    .filter(Boolean)
    .slice(0, 30) as { src: string; alt: string }[];

  const tables = $('table').length;
  const datasetHints = $('table caption')
    .map((_, el) => truncate(normalizeWhitespace($(el).text())))
    .get()
    .slice(0, 5);

  const baseHost = new URL(url).origin;
  const outboundLinks = $('a[href]')
    .map((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return null;
      const text = normalizeWhitespace($(el).text()).slice(0, 80);
      return {
        href: new URL(href, baseHost).toString(),
        text,
        isExternal: isExternal(href, baseHost)
      };
    })
    .get()
    .filter(Boolean)
    .slice(0, 40) as { href: string; text: string; isExternal: boolean }[];

  const visibleText = normalizeWhitespace($('body').text());

  const microdataTypes = $('[itemscope][itemtype]')
    .map((_, el) => ($(el).attr('itemtype') || '').split(/\s+/).filter(Boolean))
    .get()
    .flat();
  const updatedOnSnippet =
    $('time')
      .map((_, el) => normalizeWhitespace($(el).text()))
      .get()
      .find(text => UPDATED_REGEX.test(text)) ||
    paragraphsRaw.find(p => UPDATED_REGEX.test(p));

  const firstParagraphWordCount = paragraphWordCounts[0] ?? (paragraphsRaw[0]?.split(/\s+/).length ?? 0);
  const tlDrNearTop =
    paragraphsRaw.slice(0, 3).some(p => /tl;dr|key takeaways|summary/i.test(p)) || (firstParagraphWordCount > 0 && firstParagraphWordCount <= 80);

  const referenceCitationCount = $('sup.reference').length + $('a[href^="#cite"],a[href*="cite_note"]').length;

  const hasRobotsNoindex =
    $('meta[name="robots"]').attr('content')?.toLowerCase().includes('noindex') ?? false;

  return {
    title,
    description,
    headings,
    paragraphs,
    paragraphWordCounts,
    paragraphHasCitation,
    tlDrNearTop,
    claimEvidenceBlocks,
    claimCitationPairs,
    microdataTypes,
    firstParagraphWordCount,
    referenceCitationCount,
    visibleTextLength: visibleText.length,
    totalWordCount: visibleText ? visibleText.split(/\s+/).length : 0,
    inlineDates,
    canonicalUrl,
    images,
    tables,
    datasetHints,
    outboundLinks,
    updatedOnSnippet,
    hasRobotsNoindex
  };
};

export const diffHeadings = (noJs: string[], js: string[]) => {
  const normalize = (list: string[]) => list.map(h => h.toLowerCase().replace(/\s+/g, ' ').trim());
  const base = new Set(normalize(noJs));
  return normalize(js)
    .filter(h => !base.has(h))
    .map((text, idx) => `${text}#${hashText(`${text}-${idx}`)}`);
};

export const summarizeVisibleTextRatio = (noJs: string, jsText: string) => {
  const baseLen = normalizeWhitespace(noJs).length;
  const jsLen = normalizeWhitespace(jsText).length || 1;
  return Number((baseLen / jsLen).toFixed(2));
};
