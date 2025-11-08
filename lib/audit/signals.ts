import type { AuditContext, AuditSignals } from './types';

const SUPPORTED_ARTICLE_TYPES = ['Article', 'BlogPosting', 'FAQPage', 'HowTo', 'Dataset'];

const hasSupportedType = (typeValue: unknown) => {
  if (Array.isArray(typeValue)) {
    return typeValue.some(type => typeof type === 'string' && SUPPORTED_ARTICLE_TYPES.includes(type));
  }
  return typeof typeValue === 'string' && SUPPORTED_ARTICLE_TYPES.includes(typeValue);
};

const getGraphEntries = (node: Record<string, unknown>) => {
  const graph = node['@graph'];
  if (Array.isArray(graph)) {
    return graph.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null);
  }
  return [];
};

const getPrimaryNode = (node: Record<string, unknown>) => getGraphEntries(node)[0] ?? node;

const resolveTypeValue = (node: Record<string, unknown>) => {
  if (node['@type']) return node['@type'];
  const primary = getPrimaryNode(node);
  return primary['@type'];
};

const extractSameAsCount = (node: Record<string, unknown>) => {
  const value = node['sameAs'];
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string').length;
  }
  return 0;
};

export const computeSignals = (ctx: AuditContext): AuditSignals => {
  const { base, js, jsonLd, robotsTxt, sitemap, textRatioNoJs } = ctx.dual;
  const urlHost = new URL(ctx.url).hostname;

  let canonicalMatchesHost = false;
  let canonicalExists = false;
  let canonical: string | undefined;

  if (js.canonicalUrl) {
    canonicalExists = true;
    try {
      const canonicalUrl = new URL(js.canonicalUrl, ctx.url);
      canonical = canonicalUrl.toString();
      canonicalMatchesHost = canonicalUrl.hostname === urlHost;
    } catch {
      canonical = js.canonicalUrl;
    }
  }

  const faqHeadingCount = js.headings.filter(h => /\bfaq|questions?|how|why|what\b/i.test(h)).length;

  const jsonLdSupportedSchemas = jsonLd.filter(node => hasSupportedType(resolveTypeValue(node)));
  const microdataSupported = js.microdataTypes.filter(type => hasSupportedType(type)).length;
  const supportedSchemaCount = jsonLdSupportedSchemas.length + microdataSupported;

  const schemaHasRichProperties = jsonLdSupportedSchemas.some(node => {
    const target = getPrimaryNode(node);
    if (!target || typeof target !== 'object') return false;
    return Boolean(
      target['author'] && target['datePublished'] && target['publisher'] && target['mainEntityOfPage']
    );
  }) || microdataSupported > 0;

  const organizationSchemas = jsonLd.filter(node => {
    const type = node['@type'];
    if (Array.isArray(type)) return type.includes('Organization') || type.includes('WebSite');
    return type === 'Organization' || type === 'WebSite';
  });

  const personOrProductSchemas = jsonLd.filter(node => {
    const type = node['@type'];
    if (Array.isArray(type)) return type.includes('Person') || type.includes('Product');
    return type === 'Person' || type === 'Product';
  });

  const sameAsCount = organizationSchemas.reduce((sum, node) => {
    if (typeof node === 'object' && node) {
      return sum + extractSameAsCount(node as Record<string, unknown>);
    }
    return sum;
  }, 0);

  const altCoverage =
    js.images.length === 0 ? 1 : js.images.filter(img => Boolean(img.alt?.trim())).length / js.images.length;

  const microOrg = js.microdataTypes.some(type => /Organization|WebSite/i.test(type));
  const microPerson = js.microdataTypes.some(type => /Person|Product/i.test(type));

  return {
    url: ctx.url,
    faqHeadingCount,
    tlDrNearTop: js.tlDrNearTop,
    claimEvidenceBlocks: js.claimEvidenceBlocks,
    claimCitationPairs: js.claimCitationPairs,
    textRatioNoJs,
    canonical,
    canonicalExists,
    canonicalMatchesHost,
    sitemapUrl: sitemap?.url,
    sitemapFreshWithin365: sitemap?.within365Days ?? false,
    robotsAllow: robotsTxt?.allow ?? true,
    robotsUrl: robotsTxt?.url,
    metaNoindex: js.hasRobotsNoindex,
    inlineDateCount: js.inlineDates.length,
    externalLinkCount: js.outboundLinks.filter(link => link.isExternal).length,
    referenceCitationCount: js.referenceCitationCount,
    hasImages: js.images.length > 0,
    altCoverage,
    tableCount: js.tables,
    datasetHintCount: js.datasetHints.length,
    jsonLdCount: jsonLd.length,
    supportedSchemaCount,
    schemaHasRichProperties,
    organizationSchema: organizationSchemas.length > 0 || microOrg,
    personOrProductSchema: personOrProductSchemas.length > 0 || microPerson,
    sameAsCount,
    updatedOnSnippet: js.updatedOnSnippet,
    titleMatchesHeading:
      Boolean(js.title) &&
      Boolean(js.headings[0]) &&
      js.title.trim().toLowerCase() === js.headings[0].trim().toLowerCase(),
    baseHeadingCount: base.headings.length,
    jsonLdTypes: jsonLd.flatMap(node => {
      const type = node['@type'];
      if (Array.isArray(type)) return type.filter((t): t is string => typeof t === 'string');
      if (typeof type === 'string') return [type];
      return [];
    })
  };
};
