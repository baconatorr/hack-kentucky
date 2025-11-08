import { XMLParser } from 'fast-xml-parser';
import { differenceInDays, parseISO } from 'date-fns';

import { USER_AGENT } from './constants';

export type SitemapMeta = {
  url?: string;
  lastmod?: string;
  within365Days: boolean;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  allowBooleanAttributes: true,
  attributeNamePrefix: ''
});

const fetchSitemap = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/xml,text/xml' },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text;
  } catch {
    return null;
  }
};

export const resolveSitemapMeta = async (
  target: URL,
  robotsSitemaps: string[]
): Promise<SitemapMeta> => {
  const candidates = [...robotsSitemaps];
  const defaultUrl = new URL('/sitemap.xml', target.origin).toString();
  if (!candidates.includes(defaultUrl)) candidates.push(defaultUrl);

  for (const candidate of candidates) {
    const xml = await fetchSitemap(candidate);
    if (!xml) continue;
    try {
      const parsed = xmlParser.parse(xml);
      const urls = parsed.urlset?.url ?? parsed.sitemapindex?.sitemap;
      if (!urls) continue;
      const firstEntry = Array.isArray(urls) ? urls[0] : urls;
      const lastmod = firstEntry?.lastmod;
      if (typeof lastmod === 'string') {
        const date = parseISO(lastmod);
        if (!isNaN(date.getTime())) {
          const days = differenceInDays(new Date(), date);
          return {
            url: candidate,
            lastmod,
            within365Days: days <= 365
          };
        }
      }
      return { url: candidate, within365Days: false };
    } catch {
      continue;
    }
  }

  return { within365Days: false };
};
