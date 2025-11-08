import { notFound } from 'next/navigation';

import { loadRun } from '@/lib/audit/run-store';

type ReportPageProps = {
  params: { id: string };
};

export default async function ReportPage({ params }: ReportPageProps) {
  const report = await loadRun(params.id);
  if (!report) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <p className="text-sm text-muted-foreground">Run #{report.id}</p>
        <h1 className="text-3xl font-bold">GEO audit report</h1>
        <p className="text-sm text-muted-foreground">{report.url}</p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {report.pillars.map(pillar => (
          <div key={pillar.name} className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{pillar.name}</p>
              <span className="text-sm text-muted-foreground">
                {pillar.score}/{pillar.max}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${Math.round((pillar.score / pillar.max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Findings</h2>
        <div className="mt-4 space-y-3">
          {report.findings.map(finding => (
            <article key={finding.id} className="rounded-lg border border-border/60 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{finding.id}</p>
              <h3 className="text-lg font-semibold">{finding.fixTitle}</h3>
              <p className="text-sm text-muted-foreground">{finding.why}</p>
              <p className="text-sm font-medium">Where: {finding.where}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card/60 p-6">
        <h2 className="text-xl font-semibold">Raw JSON</h2>
        <pre className="mt-4 max-h-[500px] overflow-auto rounded-lg border border-border bg-background/80 p-4 text-xs">
          <code>{JSON.stringify(report, null, 2)}</code>
        </pre>
      </section>
    </main>
  );
}
