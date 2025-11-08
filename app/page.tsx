'use client';

import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PillarScore = {
  name: string;
  score: number;
  max: number;
};

type TopFix = {
  id: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  why: string;
  where: string;
  snippetHtml?: string;
  snippetJsonld?: string;
  snippetJs?: string;
};

type AuditResult = {
  id: string;
  url: string;
  geoScore: number;
  pillars: PillarScore[];
  evidence: {
    textRatioNoJS?: number;
    noJSHeadings: string[];
    jsHeadings: string[];
    missingHeadings: string[];
    jsonLdTypes: string[];
    consoleErrors: string[];
    screenshotDiffs?: {
      base?: string;
      js?: string;
    };
    canonical?: string;
    sitemap?: string;
    robots?: string;
    updatedOnText?: string;
    sitemapLastmod?: string;
  };
  findings: {
    id: string;
    fixTitle: string;
    why: string;
    where: string;
    severity: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    effort: 'low' | 'medium' | 'high';
  }[];
  topFixes: TopFix[];
  generatedArtifacts?: {
    faqPage?: {
      recommendedPath: string;
      html: string;
      jsonld: string;
      provenance: string;
    };
  };
  scoreTrace?: {
    id: string;
    pillar: string;
    title: string;
    description?: string;
    score: number;
    max: number;
    passed: boolean;
    findingId?: string;
    evidence?: string;
  }[];
};

const impactColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-500',
  medium: 'bg-amber-500/10 text-amber-500',
  low: 'bg-emerald-500/10 text-emerald-500'
};

const ScoreDial = ({ score }: { score: number }) => (
  <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-border bg-card shadow-inner">
    <div className="text-center">
      <p className="text-sm uppercase tracking-wide text-muted-foreground">GEO Score</p>
      <p className="text-5xl font-bold">{score}</p>
      <p className="text-xs text-muted-foreground">out of 100</p>
    </div>
    <div className="absolute inset-2 rounded-full border border-border/80" />
  </div>
);

const PillarGrid = ({ pillars }: { pillars: PillarScore[] }) => (
  <div className="grid gap-4 md:grid-cols-2">
    {pillars.map(pillar => {
      const pct = Math.round((pillar.score / pillar.max) * 100);
      return (
        <div key={pillar.name} className="rounded-xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">{pillar.name}</p>
            <span className="text-sm text-muted-foreground">
              {pillar.score}/{pillar.max}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className={cn('h-2 rounded-full bg-primary transition-all')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

const EvidencePanel = ({ result }: { result: AuditResult }) => {
  const evidence = result.evidence;
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-sm text-muted-foreground">text_ratio_noJS</p>
          <p className="text-2xl font-semibold">{evidence.textRatioNoJS ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Canonical</p>
          <p className="text-sm break-all">{evidence.canonical ?? 'not set'}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Sitemap</p>
          <p className="text-sm break-all">{evidence.sitemap ?? 'not detected'}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            No-JS Headings
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {evidence.noJSHeadings.slice(0, 6).map(h => (
              <li key={h} className="truncate">
                {h}
              </li>
            ))}
            {evidence.noJSHeadings.length === 0 && <li className="text-muted-foreground/70">None</li>}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            JS-only Headings
          </h3>
          <ul className="mt-2 space-y-1 text-sm text-amber-500">
            {evidence.missingHeadings.slice(0, 6).map(h => (
              <li key={h} className="truncate">
                {h.split('#')[0]}
              </li>
            ))}
            {evidence.missingHeadings.length === 0 && <li className="text-muted-foreground/70">—</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

const FixCard = ({ fix }: { fix: TopFix }) => {
  const snippets = useMemo(
    () =>
      [
        { label: 'HTML', value: fix.snippetHtml },
        { label: 'JSON-LD', value: fix.snippetJsonld },
        { label: 'Next.js', value: fix.snippetJs }
      ].filter(snippet => Boolean(snippet.value)),
    [fix]
  );

  const copySnippet = async (value: string | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', impactColors[fix.impact])}>
          impact: {fix.impact}
        </span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          effort: {fix.effort}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{fix.id.replace(/_/g, ' ')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{fix.why}</p>
      <p className="mt-2 text-sm font-medium">Where: {fix.where}</p>
      {snippets.length > 0 && (
        <div className="mt-4 space-y-3">
          {snippets.map(snippet => (
            <div key={snippet.label} className="rounded-lg border border-border bg-background/80 p-3">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide">
                <span>{snippet.label}</span>
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => copySnippet(snippet.value)}
                >
                  Copy
                </button>
              </div>
              <pre className="mt-2 overflow-x-auto text-xs text-muted-foreground">
                <code>{snippet.value}</code>
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url) {
      setError('Please enter a URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? 'Unable to run audit.');
        return;
      }
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Unexpected error while running audit.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyReport = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-border bg-card/80 p-8 shadow-lg backdrop-blur">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                GEO Audit
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight">
                Lighthouse for Generative Engine Optimization
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                Crawl any URL, compare no-JS vs JS render, and get prioritized, code-ready fixes plus optional FAQ artifacts.
              </p>
            </div>
            <form className="flex flex-col gap-4 md:flex-row" onSubmit={handleSubmit}>
              <Input
                type="url"
                placeholder="https://example.com/playbook"
                value={url}
                onChange={event => setUrl(event.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Analyzing…' : 'Run audit'}
              </Button>
            </form>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </section>

        {result && (
          <section className="space-y-6">
            <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card/70 p-8 shadow-inner md:flex-row">
              <ScoreDial score={result.geoScore} />
              <div className="flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-mono text-muted-foreground">{result.url}</p>
                  <Button variant="secondary" size="sm" onClick={copyReport}>
                    Copy JSON
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/report/${result.id}`}>View report</a>
                  </Button>
                </div>
                <PillarGrid pillars={result.pillars} />
              </div>
            </div>

            <EvidencePanel result={result} />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Top Fixes</h2>
                <p className="text-sm text-muted-foreground">Each snippet is copy-ready.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {result.topFixes.slice(0, 4).map(fix => (
                  <FixCard key={fix.id} fix={fix} />
                ))}
              </div>
            </div>

            {result.generatedArtifacts?.faqPage && (
              <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6">
                <h3 className="text-lg font-semibold">FAQ Artifact</h3>
                <p className="text-sm text-muted-foreground">
                  Deploy at <code>{result.generatedArtifacts.faqPage.recommendedPath}</code>
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Visible HTML
                    </h4>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-background/80 p-3 text-xs">
                      <code>{result.generatedArtifacts.faqPage.html}</code>
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      JSON-LD
                    </h4>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-border bg-background/80 p-3 text-xs">
                      <code>{result.generatedArtifacts.faqPage.jsonld}</code>
                    </pre>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {result.generatedArtifacts.faqPage.provenance}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
