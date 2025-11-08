import robotsParser from 'robots-parser';

import { USER_AGENT } from './constants';

export type RobotsInfo = {
  url: string;
  allow: boolean;
  disallowReason?: string;
  sitemapUrls: string[];
  rawText?: string;
};

export const fetchRobotsInfo = async (target: URL): Promise<RobotsInfo> => {
  const robotsUrl = new URL('/robots.txt', target.origin).toString();
  try {
    const response = await fetch(robotsUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
      cache: 'no-store'
    });

    if (!response.ok) {
      return {
        url: robotsUrl,
        allow: true,
        sitemapUrls: []
      };
    }

    const text = await response.text();
    const parser = robotsParser(robotsUrl, text);
    const allowed = parser.isAllowed(target.toString(), USER_AGENT);
    return {
      url: robotsUrl,
      allow: allowed !== false,
      disallowReason: allowed === false ? 'robots disallow' : undefined,
      sitemapUrls: parser.getSitemaps() || [],
      rawText: text
    };
  } catch {
    return {
      url: robotsUrl,
      allow: true,
      sitemapUrls: []
    };
  }
};
