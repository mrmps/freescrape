# llmfetch - Ralph Fix Plan

## Project Goal
Build a web-to-markdown API that works reliably on 80%+ of the web, knows when to give up, and can prove it with benchmarks.

## Core Principle
**THE BENCHMARK IS THE PRODUCT.** We don't ship until we hit targets on 1M URLs.

## Target Metrics
```
Overall success rate:     ≥80%
Tier 0 (simple fetch):    ≥90% of attempts
Tier 1 (happy-dom):       ≤8% of attempts
Blocked (give up):        ≤5% of attempts
False escalations:        ≤2% (escalated but still failed)
p95 latency:              ≤500ms
Content quality:          ≥95% have title + >100 words
```

## Stack
- **Runtime**: Node.js 22+
- **Content Extraction**: Defuddle (modern Readability alternative, built for LLMs)
- **HTML Parsing**: Cheerio (fastest, no memory leaks)
- **JS Execution**: happy-dom in isolated Worker thread (Tier 1 only)
- **Cache/DB**: better-sqlite3
- **Testing**: vitest + custom benchmark runner

### Why This Stack
- **Defuddle > Readability**: Actively maintained, built for LLM consumption, includes HTML→Markdown, extracts schema.org metadata
- **Cheerio > linkedom**: 8-12x faster than JSDOM, zero memory leaks
- **Worker isolation**: happy-dom leaks memory under load; isolate in worker thread, kill after N requests

## Architecture: 2-Tier + Block Detection

```
┌─────────────────────────────────────────────────────────────┐
│                    INCOMING URL                              │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BLOCK DETECTION (before any fetch)                          │
│  - Check robots.txt cache                                    │
│  - Check known-blocked domains list                          │
│  - Check rate limit state                                    │
│  → If blocked: return {error: "BLOCKED", reason: "..."}     │
└─────────────────────────────────────────────────────────────┘
                           │ OK to fetch
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 0: Simple Fetch                                        │
│  - fetch() with timeout                                      │
│  - linkedom parse                                            │
│  - readability extract                                       │
│  - turndown to markdown                                      │
└─────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         Got content?              Empty/Failed?
              │                         │
              ▼                         ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│  SUCCESS (Tier 0)   │   │  RESPONSE ANALYSIS              │
│  Return markdown    │   │  - Is this a block page?        │
└─────────────────────┘   │  - Cloudflare challenge?        │
                          │  - CAPTCHA?                      │
                          │  - 403/429/5xx?                  │
                          │  - Empty SPA shell?              │
                          └─────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
               Block detected?                      Might need JS?
                    │                                       │
                    ▼                                       ▼
        ┌─────────────────────┐           ┌─────────────────────────┐
        │  BLOCKED            │           │  TIER 1: happy-dom      │
        │  Return error       │           │  - Execute inline JS    │
        │  + reason           │           │  - Wait for content     │
        │  (DO NOT ESCALATE)  │           │  - Re-extract           │
        └─────────────────────┘           └─────────────────────────┘
                                                      │
                                          ┌───────────┴───────────┐
                                          │                       │
                                     Got content?            Still empty?
                                          │                       │
                                          ▼                       ▼
                              ┌─────────────────┐     ┌─────────────────┐
                              │ SUCCESS (Tier 1)│     │ BLOCKED         │
                              │ Return markdown │     │ reason: "spa"   │
                              └─────────────────┘     └─────────────────┘
```

---

## Phase 0: Benchmark Infrastructure (DO THIS FIRST)

### 0.1 Get URL dataset
- [ ] Download Tranco Top 1M list (https://tranco-list.eu/)
- [ ] Create script to sample 10K URLs for dev, 100K for CI, 1M for full
- [ ] Categorize URLs: docs, blogs, news, ecommerce, spa, api, other
- [ ] Store in data/urls.txt and data/urls-categorized.jsonl

**Success**: Have 1M URLs in data/ directory

### 0.2 Create benchmark runner
- [ ] Create src/benchmark/runner.ts
- [ ] Input: list of URLs
- [ ] Output: SQLite database with results per URL
- [ ] Schema:
  ```sql
  CREATE TABLE results (
    url TEXT PRIMARY KEY,
    status TEXT,           -- 'success' | 'blocked' | 'error'
    tier INTEGER,          -- 0 | 1 | null
    block_reason TEXT,     -- 'cloudflare' | '403' | 'timeout' | etc
    has_title BOOLEAN,
    word_count INTEGER,
    token_count INTEGER,
    latency_ms INTEGER,
    timestamp INTEGER
  );
  ```
- [ ] Run with concurrency limit (--parallel 50)
- [ ] Resume from where we left off (skip already-tested URLs)

**Success**: `npm run benchmark -- --urls data/urls-10k.txt --db results.db`

### 0.3 Create benchmark reporter
- [ ] Create src/benchmark/report.ts
- [ ] Read results database
- [ ] Output summary:
  ```
  Total URLs:        10,000
  Success:           8,234 (82.3%)
  Blocked:           1,203 (12.0%)
  Errors:              563 (5.6%)

  Tier Distribution:
    Tier 0:          9,102 (91.0%)
    Tier 1:            635 (6.4%)
    Blocked:           263 (2.6%)

  Block Reasons:
    cloudflare:        421
    timeout:           312
    403:               287
    captcha:            89
    ...

  Content Quality (of successes):
    Has title:       8,102 (98.4%)
    >100 words:      7,891 (95.8%)

  Latency:
    p50:             124ms
    p95:             467ms
    p99:            1,203ms
  ```
- [ ] Compare to previous run (show delta)
- [ ] Output JSON for CI tracking

**Success**: `npm run benchmark:report -- --db results.db`

### 0.4 Create CI benchmark job
- [ ] Add GitHub Action that runs benchmark on 10K URLs
- [ ] Fail CI if success rate drops below 75%
- [ ] Store results as artifact
- [ ] Comment on PR with delta from main

**Success**: PR shows benchmark comparison

---

## Phase 1: Project Setup

### 1.1 Initialize Node project
- [ ] Create package.json with type: "module"
- [ ] Add TypeScript with strict mode
- [ ] Add scripts: dev, build, test, benchmark, benchmark:report
- [ ] Install: typescript, @types/node, vitest

**Success**: `npm run build` works

### 1.2 Create directory structure
- [ ] src/index.ts (CLI)
- [ ] src/lib/fetch.ts
- [ ] src/lib/parse.ts
- [ ] src/lib/detect.ts (block detection)
- [ ] src/lib/escalate.ts (tier escalation)
- [ ] src/lib/happydom.ts (Tier 1)
- [ ] src/lib/cache.ts
- [ ] src/benchmark/runner.ts
- [ ] src/benchmark/report.ts
- [ ] data/.gitkeep
- [ ] test/*.test.ts

**Success**: All files exist

### 1.3 Unit test setup
- [ ] Install vitest
- [ ] Create test/parse.test.ts
- [ ] Create test/detect.test.ts
- [ ] `npm test` passes

---

## Phase 2: Block Detection (THE KEY DIFFERENTIATOR)

### 2.1 HTTP response analysis
- [ ] Create analyzeResponse(status, headers, html): BlockResult | null
- [ ] Detect by status code:
  - 403 → {blocked: true, reason: "forbidden"}
  - 429 → {blocked: true, reason: "rate_limited"}
  - 503 → {blocked: true, reason: "service_unavailable"}
- [ ] Detect by headers:
  - cf-ray header → likely Cloudflare
  - x-amz-cf-id → CloudFront
  - server: AkamaiGHost → Akamai

### 2.2 HTML content analysis
- [ ] Create detectBlockPage(html): BlockResult | null
- [ ] Cloudflare patterns:
  - "Just a moment..." title
  - "Checking your browser"
  - "cf-browser-verification"
  - "_cf_chl_opt" in script
- [ ] CAPTCHA patterns:
  - "recaptcha" in HTML
  - "hcaptcha" in HTML
  - "captcha" in form action
- [ ] Generic block patterns:
  - "Access Denied"
  - "Request blocked"
  - "Bot detected"
- [ ] Return {blocked: true, reason: "cloudflare" | "captcha" | "waf"}

**Test**: Unit tests with real block page HTML samples

### 2.3 SPA detection (for escalation, NOT blocking)
- [ ] Create needsJavaScript(html, extractedContent): boolean
- [ ] True if:
  - extractedContent is empty AND
  - HTML has <div id="root"></div> or similar AND
  - HTML has <script> tags AND
  - NOT a block page
- [ ] False if block page detected (don't escalate, just fail)

**Test**:
```typescript
// Block page - don't escalate
expect(needsJavaScript(cloudflareHtml, null)).toBe(false)

// SPA - do escalate
expect(needsJavaScript(reactAppHtml, null)).toBe(true)

// Static page - don't escalate
expect(needsJavaScript(staticHtml, "content")).toBe(false)
```

---

## Phase 3: Core Fetch (Tier 0)

### 3.1 HTTP fetch with timeout
- [ ] Create fetchUrl(url, options): Promise<FetchResult>
- [ ] Options: timeout (default 10s), headers, followRedirects
- [ ] Handle: network errors, DNS errors, SSL errors, timeouts
- [ ] Return: {html, status, headers, latencyMs} or {error, reason}

### 3.2 Content extraction with Defuddle
- [ ] Install defuddle: `npm install defuddle`
- [ ] Create extractContent(html, url): ExtractResult | null
- [ ] Use Defuddle with `markdown: true` option for direct MD output
- [ ] Extract: title, content (markdown), author, published, wordCount, parseTime
- [ ] Return null if extraction fails (empty content)

**Test**:
```typescript
import { Defuddle } from 'defuddle/node';
const result = await Defuddle(html, { markdown: true });
expect(result.content).toContain("expected text");
expect(result.title).toBeDefined();
expect(result.parseTime).toBeLessThan(100); // ms
```

### 3.3 Wire together with block detection
- [ ] Create fetchAndParse(url): Promise<Result>
- [ ] Flow:
  1. fetchUrl()
  2. If error → return error
  3. analyzeResponse() → if blocked → return blocked
  4. extractContent() with Defuddle
  5. If empty → detectBlockPage() → if blocked → return blocked
  6. If empty → needsJavaScript() → if true → escalate to Tier 1
  7. Return success with markdown content

---

## Phase 4: Tier 1 - happy-dom (Worker Isolated)

**CRITICAL**: happy-dom leaks memory. MUST run in isolated worker thread.

### 4.1 Create worker thread for JS execution
- [ ] Create src/lib/happydom-worker.ts (runs in Worker)
- [ ] Create src/lib/happydom.ts (main thread interface)
- [ ] Worker receives: {html, url, timeout}
- [ ] Worker returns: {html: string} or {error: string}
- [ ] Main thread spawns worker, sends message, receives result
- [ ] Worker auto-terminates after 100 requests OR on any error

**Worker pattern**:
```typescript
// happydom-worker.ts (runs in Worker thread)
import { parentPort } from 'worker_threads';
import { Window } from 'happy-dom';

let requestCount = 0;
const MAX_REQUESTS = 100;

parentPort?.on('message', async ({ html, url, timeout }) => {
  requestCount++;

  const window = new Window({ url });
  window.document.write(html);

  // Wait for content (poll every 100ms, max timeout)
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (window.document.body.textContent.trim().length > 100) break;
    await new Promise(r => setTimeout(r, 100));
  }

  const result = window.document.documentElement.outerHTML;
  window.close();

  parentPort?.postMessage({ html: result });

  // Self-terminate after MAX_REQUESTS to clear memory
  if (requestCount >= MAX_REQUESTS) {
    process.exit(0);
  }
});
```

### 4.2 Worker pool manager
- [ ] Create WorkerPool class in src/lib/happydom.ts
- [ ] Pool size: 1-4 workers (configurable)
- [ ] Round-robin or least-busy assignment
- [ ] Auto-restart workers that die
- [ ] Graceful shutdown on process exit

### 4.3 Integrate with pipeline
- [ ] When needsJavaScript() returns true, call workerPool.execute(html, url)
- [ ] Re-run Defuddle extractContent() on result
- [ ] If still empty → return {blocked: true, reason: "spa_failed"}
- [ ] Track tier=1 in result
- [ ] Log worker restarts for monitoring

---

## Phase 5: CLI Interface

### 5.1 Basic CLI
- [ ] Parse args: llmfetch <url> [options]
- [ ] Options: --format (md|json|text), --timeout, --no-cache
- [ ] Output markdown to stdout, errors to stderr

### 5.2 Filtering options
- [ ] --max-tokens <n>: truncate at token limit
- [ ] --grep <pattern>: filter to matching sections
- [ ] --select <selector>: extract specific elements

### 5.3 Batch mode
- [ ] Read URLs from stdin or @file.txt
- [ ] --parallel <n>: concurrent requests
- [ ] Output JSONL

---

## Phase 6: Caching

### 6.1 SQLite cache
- [ ] Cache successful responses by URL hash
- [ ] TTL: 5 minutes default, configurable
- [ ] --no-cache to bypass
- [ ] --cache-ttl <seconds>

---

## Completed
- [x] Project concept
- [x] Architecture design
- [x] Block detection strategy

---

## Exit Criteria

Ralph should EXIT when:
1. All tasks above are [x]
2. `npm test` passes
3. Benchmark on 10K URLs shows:
   - Success rate ≥75%
   - Block detection working (Cloudflare, CAPTCHA detected correctly)
   - Tier 1 activates only when needed
4. CLI works for all documented commands

---

## Notes

### Block Page Samples to Collect
We need real HTML samples of:
- Cloudflare challenge pages (various types)
- Akamai block pages
- AWS WAF blocks
- Google CAPTCHA pages
- hCaptcha pages
- PerimeterX blocks
- DataDome blocks
- Generic "Access Denied" pages

Store these in test/fixtures/block-pages/ for unit tests.

### URL Categories for Benchmark
- docs: developer documentation sites
- blog: personal and company blogs
- news: news articles
- ecommerce: product pages
- spa: known React/Vue/Angular sites
- api: API documentation
- wiki: Wikipedia and wiki-style sites
- forum: Reddit, HN, forums
- social: Twitter, LinkedIn (likely blocked)

### Iteration Loop
```
while success_rate < 80%:
  1. Run benchmark
  2. Analyze failures
  3. Improve detection/extraction
  4. Repeat
```
