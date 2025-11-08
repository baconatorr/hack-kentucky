<h1 align="center">GEO Audit — Lighthouse for Generative Engine Optimization</h1>

GEO Audit is a production-ready Next.js app that crawls any public URL, compares no-JS vs JS rendering, evaluates on-page GEO signals, and returns prioritized, code-ready fixes plus optional FAQ artifacts that can be deployed server-side. The whole pipeline is deterministic (no LLM runtime requirement) and honors the guardrails laid out in the prompt.

---

## Highlights

- **Dual render engine** — `fetch` + Cheerio for raw HTML and Playwright/Chromium for JS render. Captures TTFB, HTML size, visible text, screenshots, console errors, and heading diffs.
- **Deterministic scoring** — Implements the 100-point rubric across Answer Readiness, Schema, Rendering, Evidence, and Entity Clarity with red-flag penalties.
- **Actionable fixes** — Each failed rule maps to ready-to-ship snippets (HTML, JSON-LD, Next.js SSR, robots, dataset downloads, etc.) with impact × effort metadata.
- **FAQ artifact generator** — Builds visible FAQ blocks + matching JSON-LD (with provenance) when missing, and exposes `/api/generate-faq`.
- **Guardrails baked in** — Robots.txt respected, no full HTML stored, schema always matches visible text, SSR-first recommendations for critical content.
- **Artifacts for teams** — Persistent run storage (`/report/[id]`), Postman collection, JSON Schemas for the APIs, and five sample reports covering the required test scenarios.

---

## Getting Started

```bash
npm install               # installs Next.js + audit dependencies
npx playwright install    # install Chromium once for JS rendering
npm run dev               # start local dev server on http://localhost:3000
```

Environment variables are optional for the audit workflow; you only need Supabase keys if you later wire up auth/data persistence.

---

## API Surface

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/analyze` | `POST` | Runs the full GEO audit pipeline. Body: `{"url":"https://..."};` responds with the full JSON report plus optional FAQ artifact. |
| `/api/generate-faq` | `POST` | Generates the optional FAQ artifact (visible HTML + JSON-LD + provenance) for the URL. |
| `/report/[id]` | `GET` | Server-rendered view of a stored audit run (`id` returned from `/api/analyze`). |

Validation:

- Request bodies validated with Zod.
- Response contracts captured in `schemas/analyze-response.schema.json` and `schemas/generate-faq-response.schema.json`.

Use the Postman collection at `postman/geo-audit.postman_collection.json` with the `baseUrl` variable (defaults to `http://localhost:3000`).

---

## Scoring & Findings

- **Answer Readiness (25 pts)** — FAQ/Q&A detection, TL;DR, claim→evidence proximity, citations.
- **Schema & Structured Data (20 pts)** — JSON-LD availability, supported types (Article/FAQ/Dataset/HowTo), author/dates/publisher/mainEntity coverage.
- **Rendering & Indexability (20 pts)** — `text_ratio_noJS`, canonical correctness, sitemap discovery, robots sanity (+ red flags for CSR/noindex).
- **Evidence Packaging (15 pts)** — Inline dates, outbound primary links, descriptive alt text, tables/downloadable datasets.
- **Entity Clarity (10 pts)** — Organization + Person/Product schema, consistent naming across H1/meta/schema, `sameAs` references.
 

Failed checks map to findings with severity, `why/where`, and snippet strings. The `topFixes` array (3–5 items) is derived from those findings and mirrors the API contract requirement.

---

## Dual Render Pipeline

1. **HTML_base** — guarded `fetch` with size cap + SSRF protections. Measures bytes + TTFB, parses via Cheerio, and captures headings/paragraphs/snippets only (never full HTML persisted).
2. **HTML_js** — Playwright/Chromium render (`networkidle`), console error capture, visible text extraction, and screenshot capture for side-by-side evidence.
3. **Diff & scoring** — Computes `text_ratio_noJS`, missing headings, inline dates, canonical, sitemap, robots, schema payloads, table/dataset hints, and outbound link stats.
4. **Suggestions & artifacts** — Templates defined in `lib/audit/suggestions.ts` generate the copy-ready code. FAQ artifact emitted when FAQ coverage is missing.

---

## Guardrails & Data Policy

- **Robots-aware** — `/api/analyze` gracefully returns HTTP 451 with `robots disallows` when blocked.
- **No hidden content** — Generated FAQ HTML and JSON-LD share identical text, no display hacks, and provenance lines cite the source URL + date.
- **No full HTML storage** — Only snippets/metrics are persisted per run (see `lib/audit/run-store.ts`), complying with the “hash/snippet only” requirement.
- **Server-side fixes prioritized** — Snippets include Next.js `getStaticProps`/SSG examples, canonical tags, robots policies, and dataset downloads.

---

## Test Plan (per acceptance criteria)

Five sample JSON outputs live in `/samples`:

1. `heavy-csr-blog.json` — CSR-heavy blog (expect text ratio red flag).
2. `article-no-schema.json` — Article lacking JSON-LD.
3. `rich-faq-page.json` — FAQ-rich reference page (high Answer Readiness).
4. `data-article.json` — Article with tables needing Dataset schema.
5. `robots-disallowed.json` — Site blocked via robots (`cannot_audit` state).

Manual verification checklist:

- `text_ratio_noJS` present in responses and UI.
- When schema issues occur, at least one suggestion includes both visible HTML + JSON-LD.
- Suggestion snippets never include hidden CSS (`display:none`, opacity hacks).
- `/api/analyze` completes within 15s for <2 MB pages (bounded fetch + Playwright timeout).
- `/report/[id]` renders stored runs without leaking HTML bodies.

---

## Repository Layout

```
app/
  api/analyze        → GEO audit API route (Node runtime)
  api/generate-faq   → FAQ artifact endpoint
  report/[id]        → SSR report pages
components/ui        → Shadcn/Tailwind UI primitives
lib/audit/           → Dual-render pipeline, scoring, suggestions, FAQ generator, run store
schemas/             → JSON Schemas for API responses
postman/             → Postman collection
samples/             → Required sample outputs
```

---

## Next Steps

- Hook the run storage into Supabase/Postgres using the provided SQL-ish data model (`queries`, `runs`, `audits`, etc.).
- Schedule recurring audits per domain and surface trends over time.
- Extend `topFixes` mapping to include code-diff previews sourced from the repo under test.

PRs and issues welcome!
