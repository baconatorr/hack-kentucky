import dns from 'node:dns/promises';
import net from 'node:net';
import { performance } from 'node:perf_hooks';

import { MAX_HTML_BYTES, REQUEST_TIMEOUT_MS, USER_AGENT } from './constants';

const SCRIPT_TAG_PATTERN = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const TAG_PATTERN = /<[^>]+>/g;

const createScriptRegex = () => new RegExp(SCRIPT_TAG_PATTERN.source, SCRIPT_TAG_PATTERN.flags);
const createTagRegex = () => new RegExp(TAG_PATTERN.source, TAG_PATTERN.flags);

const isPrivateIp = (ip: string) => {
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length === 4) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
  }
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80')) return true;
  return false;
};

export const guardUrl = async (u: URL) => {
  const host = u.hostname;
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked private IP host.');
    return;
  }

  try {
    const [a, aaaa] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
    const addrs: string[] = [];
    if (a.status === 'fulfilled') addrs.push(...a.value);
    if (aaaa.status === 'fulfilled') addrs.push(...aaaa.value);
    for (const ip of addrs) {
      if (isPrivateIp(ip)) throw new Error('Blocked private DNS resolution.');
    }
  } catch {
    // Ignore DNS errors and let fetch throw instead.
  }
};

type FetchOpts = {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
  maxBytes?: number;
  accept?: string;
};

export type FetchHtmlResult = {
  html: string;
  bytes: number;
  ttfbMs: number;
  contentType: string;
};

export const fetchHtml = async (url: string, opts: FetchOpts = {}): Promise<FetchHtmlResult> => {
  const {
    timeoutMs = REQUEST_TIMEOUT_MS,
    retries = 2,
    backoffMs = 600,
    maxBytes = MAX_HTML_BYTES,
    accept = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
  } = opts;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = performance.now();

    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.9'
        },
        signal: controller.signal
      });

      const ttfbMs = performance.now() - start;
      clearTimeout(timeout);

      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
          throw new Error(`Fetch failed with status ${res.status}`);
        }
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
          continue;
        }
        throw new Error(`Fetch failed with status ${res.status}`);
      }

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('text/html') && !ct.includes('application/xhtml+xml')) {
        throw new Error('URL did not return HTML.');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Missing response body.');

      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            reader.cancel();
            throw new Error('Page is too large to analyze.');
          }
          chunks.push(value);
        }
      }

      const buffer = Buffer.concat(chunks);
      return {
        html: buffer.toString('utf8'),
        bytes: buffer.byteLength,
        ttfbMs,
        contentType: ct
      };
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastErr ?? new Error('Unknown fetch failure');
};

export const stripTags = (html: string) =>
  html.replace(createScriptRegex(), ' ').replace(createTagRegex(), ' ');
