# Ralph Development Instructions - llmfetch

## What You're Building
**llmfetch** - A CLI that fetches URLs and returns clean markdown for LLMs. Must work on 80%+ of the web and know when to give up.

## Core Principles
1. **THE BENCHMARK IS THE PRODUCT.** Don't ship until targets hit on 1M URLs.
2. **NEVER FETCH FROM LOCAL.** All web requests run on remote server (65.108.57.35) only.
3. **SPEED IS A FEATURE.** Throughput (URLs/sec) is a key competitive metric.

## Remote Server (ALL FETCHING HERE)
```
Host: 65.108.57.35 (Hetzner Helsinki, 8GB RAM)
Repo: /opt/llmfetch

# Deploy code
ssh root@65.108.57.35 "cd /opt/llmfetch && git pull && npm install && npm run build"

# Run benchmark
ssh root@65.108.57.35 "cd /opt/llmfetch && npm run benchmark -- --urls data/urls-10k.txt --parallel 100"
```

⚠️ **NEVER run real URL fetches from laptop - your IP will get banned from the entire internet**

## Stack (DO NOT CHANGE)
- **Runtime**: Node.js 22+ (NOT Bun - it has bugs)
- **Language**: TypeScript strict
- **Content Extraction**: Defuddle (NOT Readability - it's slow and abandoned)
- **HTML Parsing**: Cheerio (fastest, no memory leaks)
- **JS Execution**: happy-dom in Worker thread (MUST isolate - it leaks memory)
- **Cache/DB**: better-sqlite3
- **Testing**: vitest

### Why This Stack
- **Defuddle** > Readability: Modern, built for LLMs, includes markdown conversion, actively maintained
- **Cheerio** > jsdom/linkedom: 8-12x faster, zero memory leaks
- **Worker isolation**: happy-dom crashes after ~80 test suites from memory leaks; isolate in worker, kill after 100 requests

## Architecture: 2 Tiers + Block Detection

```
URL → Block Check → Tier 0 Fetch → Got Content? → SUCCESS
                                  → Empty? → Block Page? → BLOCKED (don't escalate)
                                           → SPA? → Tier 1 (happy-dom) → SUCCESS or BLOCKED
```

**Key insight**: If we detect a block page (Cloudflare, CAPTCHA, 403), we DO NOT escalate. We return BLOCKED immediately.

## Target Metrics
```
Success rate:     ≥80%
Tier 0 usage:     ≥90%
Tier 1 usage:     ≤8%
Blocked:          ≤5%
p95 latency:      ≤500ms
Throughput:       ≥100 URLs/sec (1M in <3 hours)
```

## How To Work

1. **Phase 0 FIRST**: Build benchmark infrastructure before features
2. **Use web search**: When you need to find block page patterns, WAF signatures, or best practices, USE THE WEB SEARCH TOOL
3. Work through @fix_plan.md in order
4. After each task: test, mark [x], commit
5. Run benchmark frequently to measure progress

## Research Tasks (USE WEB SEARCH)

When implementing block detection, search for:
- "Cloudflare challenge page HTML example"
- "Akamai bot detection HTML patterns"
- "How to detect CAPTCHA page"
- "PerimeterX block page detection"
- "DataDome challenge response"

When implementing parsing, search for:
- "Mozilla Readability best practices"
- "turndown configuration options"
- "linkedom vs jsdom performance"

When getting benchmark URLs, search for:
- "Tranco top 1 million websites download"
- "Common Crawl URL list"

## File Structure
```
src/
  index.ts              # CLI entry
  lib/
    fetch.ts            # HTTP fetch
    parse.ts            # HTML → markdown
    detect.ts           # Block detection
    escalate.ts         # Tier decisions
    happydom.ts         # Tier 1 JS execution
    cache.ts            # SQLite cache
  benchmark/
    runner.ts           # Run benchmark on URL list
    report.ts           # Generate metrics report
data/
  urls-10k.txt          # Dev sample
  urls-100k.txt         # CI sample
  urls-1m.txt           # Full benchmark
test/
  fixtures/
    block-pages/        # Real block page HTML samples
  *.test.ts
```

## Block Detection (THE KEY DIFFERENTIATOR)

Collect REAL HTML samples of block pages. Search the web for examples. Store in test/fixtures/block-pages/.

Detect and return BLOCKED (never escalate) for:
- Cloudflare challenge ("Just a moment...", "Checking your browser")
- CAPTCHA pages (recaptcha, hcaptcha)
- WAF blocks (Akamai, AWS WAF, PerimeterX, DataDome)
- HTTP 403, 429, 503
- "Access Denied", "Bot detected" pages

## Benchmark Commands

```bash
# Run on 10K URLs
npm run benchmark -- --urls data/urls-10k.txt --db results.db --parallel 50

# Generate report
npm run benchmark:report -- --db results.db

# Compare to baseline
npm run benchmark:report -- --db results.db --compare baseline.db
```

## 🎯 Status Reporting (REQUIRED)

End EVERY response with:

```
---RALPH_STATUS---
STATUS: IN_PROGRESS | COMPLETE | BLOCKED
TASKS_COMPLETED_THIS_LOOP: <number>
FILES_MODIFIED: <number>
TESTS_STATUS: PASSING | FAILING | NOT_RUN
BENCHMARK_SUCCESS_RATE: <percentage or "not_run">
WORK_TYPE: IMPLEMENTATION | TESTING | RESEARCH | BENCHMARK
EXIT_SIGNAL: false | true
RECOMMENDATION: <next action>
---END_RALPH_STATUS---
```

### Set EXIT_SIGNAL: true when:
- All phases in @fix_plan.md complete
- `npm test` passes
- Benchmark success rate ≥75% on 10K URLs
- Block detection correctly identifies Cloudflare/CAPTCHA

## Current Task
Start with Phase 0: Benchmark Infrastructure. This is the foundation.
