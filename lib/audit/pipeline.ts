import { guardUrl, fetchHtml } from './network';
import { buildSnapshot, diffHeadings } from './extract';
import { fetchRobotsInfo } from './robots';
import { resolveSitemapMeta } from './sitemap';
import { renderWithJs, captureHtmlOnlyScreenshot } from './playwright';
import type { AuditContext, DualRenderArtifacts } from './types';

export const buildDualRenderArtifacts = async (
  url: string,
  runId: string
): Promise<DualRenderArtifacts> => {
  const parsed = new URL(url);
  await guardUrl(parsed);

  const robots = await fetchRobotsInfo(parsed);
  if (!robots.allow) {
    throw new Error('Robots.txt disallows auditing this path.');
  }

  const [baseResponse, jsPayload, baseScreenshot, sitemapMeta] = await Promise.all([
    fetchHtml(parsed.toString()),
    renderWithJs(parsed.toString(), runId),
    captureHtmlOnlyScreenshot(parsed.toString(), runId),
    resolveSitemapMeta(parsed, robots.sitemapUrls)
  ]);

  const baseSnapshot = buildSnapshot(baseResponse.html, parsed.toString());
  const jsSnapshot = jsPayload ? buildSnapshot(jsPayload.html, parsed.toString()) : baseSnapshot;

  const textRatioNoJs = Number(
    ((baseSnapshot.visibleTextLength || 1) /
      (jsSnapshot.visibleTextLength || baseSnapshot.visibleTextLength || 1)).toFixed(2)
  );

  return {
    base: {
      ...baseSnapshot,
      bytes: baseResponse.bytes,
      ttfbMs: baseResponse.ttfbMs
    },
    js: {
      ...jsSnapshot,
      consoleErrors: jsPayload?.consoleErrors ?? []
    },
    screenshots: {
      base: baseScreenshot,
      js: jsPayload?.screenshotPath
    },
    jsonLd: extractJsonLd(jsPayload?.html ?? baseResponse.html),
    robotsTxt: robots,
    sitemap: sitemapMeta,
    textRatioNoJs,
    missingHeadings: diffHeadings(baseSnapshot.headings, jsSnapshot.headings)
  };
};

const extractJsonLd = (html: string) => {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!matches) return [];
  const json: Record<string, unknown>[] = [];
  for (const match of matches) {
    const inner = match
      .replace(/^<script[^>]+type=["']application\/ld\+json["'][^>]*>/i, '')
      .replace(/<\/script>$/i, '');
    try {
      const parsed = JSON.parse(inner);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => {
          if (typeof item === 'object' && item) json.push(item);
        });
      } else if (typeof parsed === 'object' && parsed) {
        json.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return json;
};

export const buildAuditContext = async (url: string, runId: string): Promise<AuditContext> => {
  const dual = await buildDualRenderArtifacts(url, runId);
  return {
    url,
    dual,
    timestamp: new Date().toISOString()
  };
};
