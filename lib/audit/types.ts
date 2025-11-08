import { z } from 'zod';

export const PillarNameSchema = z.enum([
  'Answer Readiness',
  'Schema & Structured Data',
  'Rendering & Indexability',
  'Evidence Packaging',
  'Entity Clarity'
]);

export type PillarName = z.infer<typeof PillarNameSchema>;

export const PillarSchema = z.object({
  name: PillarNameSchema,
  score: z.number().min(0),
  max: z.number().min(0),
  details: z.array(z.string()).optional()
});

export type Pillar = z.infer<typeof PillarSchema>;

export type RuleEvaluation = {
  id: string;
  pillar: PillarName;
  title: string;
  description?: string;
  score: number;
  max: number;
  passed: boolean;
  findingId?: string;
  evidence?: string;
};

export type AuditSignals = {
  url: string;
  faqHeadingCount: number;
  tlDrNearTop: boolean;
  claimEvidenceBlocks: number;
  claimCitationPairs: number;
  textRatioNoJs: number;
  canonical?: string;
  canonicalExists: boolean;
  canonicalMatchesHost: boolean;
  sitemapUrl?: string;
  sitemapFreshWithin365: boolean;
  robotsAllow: boolean;
  robotsUrl?: string;
  metaNoindex: boolean;
  inlineDateCount: number;
  externalLinkCount: number;
  referenceCitationCount: number;
  hasImages: boolean;
  altCoverage: number;
  tableCount: number;
  datasetHintCount: number;
  jsonLdCount: number;
  supportedSchemaCount: number;
  schemaHasRichProperties: boolean;
  organizationSchema: boolean;
  personOrProductSchema: boolean;
  sameAsCount: number;
  updatedOnSnippet?: string;
  titleMatchesHeading: boolean;
  baseHeadingCount: number;
  jsonLdTypes: string[];
};

export const EvidenceSchema = z.object({
  textRatioNoJS: z.number().min(0).optional(),
  noJSHeadings: z.array(z.string()).default([]),
  jsHeadings: z.array(z.string()).default([]),
  missingHeadings: z.array(z.string()).default([]),
  jsonLdTypes: z.array(z.string()).default([]),
  consoleErrors: z.array(z.string()).default([]),
  screenshotDiffs: z
    .object({
      base: z.string().optional(),
      js: z.string().optional()
    })
    .optional(),
  canonical: z.string().optional(),
  sitemap: z.string().optional(),
  robots: z.string().optional(),
  updatedOnText: z.string().optional(),
  sitemapLastmod: z.string().optional()
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export const FixSnippetSchema = z.object({
  html: z.string().optional(),
  jsonld: z.string().optional(),
  js: z.string().optional()
});

export type FixSnippet = z.infer<typeof FixSnippetSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  where: z.string(),
  why: z.string(),
  fixTitle: z.string(),
  snippetHtml: z.string().optional(),
  snippetJsonld: z.string().optional(),
  snippetJs: z.string().optional(),
  impact: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
  evidence: z.string().optional()
});

export type Finding = z.infer<typeof FindingSchema>;

export const TopFixSchema = z.object({
  id: z.string(),
  impact: z.enum(['low', 'medium', 'high']),
  effort: z.enum(['low', 'medium', 'high']),
  why: z.string(),
  where: z.string(),
  snippetHtml: z.string().optional(),
  snippetJsonld: z.string().optional(),
  snippetJs: z.string().optional()
});

export type TopFix = z.infer<typeof TopFixSchema>;

export const FaqArtifactSchema = z.object({
  recommendedPath: z.string(),
  html: z.string(),
  jsonld: z.string(),
  provenance: z.string()
});

export type FaqArtifact = z.infer<typeof FaqArtifactSchema>;

export const GeneratedArtifactsSchema = z
  .object({
    faqPage: FaqArtifactSchema.optional()
  })
  .optional();

export type GeneratedArtifacts = z.infer<typeof GeneratedArtifactsSchema>;

export const AuditResultSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  geoScore: z.number().min(0).max(100),
  pillars: z.array(PillarSchema),
  evidence: EvidenceSchema,
  findings: z.array(FindingSchema),
  topFixes: z.array(TopFixSchema),
  generatedArtifacts: GeneratedArtifactsSchema,
  scoreTrace: z
    .array(
      z.object({
        id: z.string(),
        pillar: PillarNameSchema,
        title: z.string(),
        description: z.string().optional(),
        score: z.number(),
        max: z.number(),
        passed: z.boolean(),
        findingId: z.string().optional(),
        evidence: z.string().optional()
      })
    )
    .optional()
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

export type RenderSnapshot = {
  title: string;
  description?: string;
  headings: string[];
  paragraphs: string[];
  paragraphWordCounts: number[];
  paragraphHasCitation: boolean[];
  tlDrNearTop: boolean;
  claimEvidenceBlocks: number;
  claimCitationPairs: number;
  microdataTypes: string[];
  firstParagraphWordCount: number;
  referenceCitationCount: number;
  visibleTextLength: number;
  totalWordCount: number;
  inlineDates: string[];
  canonicalUrl?: string;
  images: { src: string; alt: string }[];
  tables: number;
  datasetHints: string[];
  outboundLinks: { href: string; text: string; isExternal: boolean }[];
  updatedOnSnippet?: string;
  hasRobotsNoindex: boolean;
};

export type DualRenderArtifacts = {
  base: RenderSnapshot & {
    bytes: number;
    ttfbMs: number;
  };
  js: RenderSnapshot & {
    consoleErrors: string[];
  };
  screenshots: {
    base?: string;
    js?: string;
  };
  jsonLd: Record<string, unknown>[];
  robotsTxt?: {
    url: string;
    allow: boolean;
    disallowReason?: string;
    sitemapUrls: string[];
    rawText?: string;
  };
  sitemap?: {
    url?: string;
    lastmod?: string;
    within365Days: boolean;
  };
  textRatioNoJs: number;
  missingHeadings: string[];
};

export type AuditContext = {
  url: string;
  dual: DualRenderArtifacts;
  timestamp: string;
};
