export const USER_AGENT = 'GEOAuditBot/1.0 (+https://hack-kentucky)';

export const MAX_HTML_BYTES = 2_000_000; // 2 MB
export const REQUEST_TIMEOUT_MS = 12_000;
export const PLAYWRIGHT_TIMEOUT_MS = 15_000;

export const PILLAR_MAX = {
  'Answer Readiness': 25,
  'Schema & Structured Data': 20,
  'Rendering & Indexability': 20,
  'Evidence Packaging': 15,
  'Entity Clarity': 10
} as const;

export const RED_FLAG_PENALTY = 10;
