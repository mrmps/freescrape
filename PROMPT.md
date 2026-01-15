# llmfetch - Ralph Development Instructions

## What You're Building

**llmfetch** - A CLI/API that fetches any URL and returns clean markdown optimized for LLMs.

Goal: **Best web-to-markdown tool on the planet.** Fast, reliable, knows when to give up.

## Success Criteria (ALL MUST BE MET TO EXIT)

These are the ONLY things that matter. Everything else is up to you.

### 1. Benchmark Success Rate
```
Target: ≥80% success rate on 10K diverse URLs
Measurement: npm run benchmark:report -- --db results.db
Verify: "Success: X,XXX (≥80.0%)"
```

### 2. Throughput
```
Target: ≥50 URLs/second sustained
Measurement: Benchmark output shows "XX.X URLs/sec"
Verify: Rate ≥50.0 during 10K URL run
```

### 3. Latency
```
Target: p95 ≤ 2000ms, p50 ≤ 500ms
Measurement: npm run benchmark:report shows latency stats
Verify: p95 and p50 within targets
```

### 4. Block Detection Accuracy
```
Target: Correctly identify ≥90% of block pages (Cloudflare, CAPTCHA, WAF)
Measurement: Test suite with real block page HTML samples
Verify: npm test passes with block detection tests
```

### 5. Content Quality
```
Target: ≥90% of successful extractions have title AND >100 words
Measurement: npm run benchmark:report shows content quality stats
Verify: "Has title: ≥90%" and ">100 words: ≥90%"
```

### 6. Memory Stability
```
Target: Memory usage stays <4GB during 10K URL benchmark
Measurement: Benchmark progress output shows "Mem: XXX MB"
Verify: Never exceeds 4000MB during run
```

### 7. All Tests Pass
```
Target: npm test exits with code 0
Measurement: Run npm test
Verify: All tests pass, no failures
```

## Verification Command

Run this on remote server to verify all criteria:
```bash
ssh llmfetch "cd /opt/llmfetch && npm test && npm run benchmark -- --urls data/urls-10k.txt --db verify.db --parallel 100 && npm run benchmark:report -- --db verify.db"
```

Check output for:
- Success rate ≥80%
- URLs/sec ≥50
- p95 ≤2000ms, p50 ≤500ms
- Has title ≥90%
- >100 words ≥90%
- Memory stayed <4GB
- All tests passed

## Hard Constraints

### 1. NEVER fetch from local machine
All HTTP requests to external URLs MUST run on the remote server. Your local IP will get banned.

```bash
# Deploy code
ssh llmfetch "cd /opt/llmfetch && git pull && npm install && npm run build"

# Run benchmarks
ssh llmfetch "cd /opt/llmfetch && npm run benchmark -- --urls data/urls-10k.txt --db results.db --parallel 100"
```

### 2. Remote Server
```
Host: 65.108.57.35 (SSH alias: llmfetch)
Path: /opt/llmfetch
Specs: 8GB RAM, Hetzner Helsinki
```

## Everything Else Is Up To You

- **Language**: TypeScript, Rust, Go, Python - whatever achieves the targets
- **Libraries**: Choose what works. Benchmark if unsure.
- **Architecture**: Design what makes sense
- **Approach**: Rewrite everything if needed

If the current approach isn't hitting targets, throw it away and try something else. Only the success criteria matter.

## Research

Use web search to find:
- Best practices for web scraping at scale
- Block page detection patterns (Cloudflare, Akamai, PerimeterX, DataDome)
- Fast HTML-to-markdown libraries (benchmark them!)
- Memory-efficient parsing
- How r.jina.ai, trafilatura, newspaper3k solve these problems

## Status Reporting

End EVERY response with:

```
---RALPH_STATUS---
SUCCESS_RATE: <percentage or "not_measured">
THROUGHPUT: <urls/sec or "not_measured">
P95_LATENCY: <ms or "not_measured">
MEMORY_PEAK: <mb or "not_measured">
TESTS: PASS | FAIL | NOT_RUN
CRITERIA_MET: <number>/7
EXIT_READY: true | false
NEXT_ACTION: <what you'll do next>
---END_RALPH_STATUS---
```

Set EXIT_READY: true ONLY when all 7 criteria are verified as met.
