# llmfetch - Success Criteria Tracker

## Goal

Build the best web-to-markdown tool for LLMs. Fast, reliable, knows when to give up.

## Success Criteria Checklist

All 7 must be met to exit:

| # | Criteria | Target | Current | Status |
|---|----------|--------|---------|--------|
| 1 | Success Rate | ≥80% on 10K URLs | 2.9% | [ ] |
| 2 | Throughput | ≥50 URLs/sec | ~10 | [ ] |
| 3 | Latency p95 | ≤2000ms | 4913ms | [ ] |
| 4 | Latency p50 | ≤500ms | 2529ms | [ ] |
| 5 | Content Quality (title) | ≥90% have title | 96.6% | [x] |
| 6 | Content Quality (words) | ≥90% have >100 words | 75.9% | [ ] |
| 7 | Memory | <4GB during benchmark | ~1.4GB | [x] |
| 8 | Tests | All pass | 9/9 passing | [x] |

## How to Measure

```bash
# Run full verification on remote server
ssh llmfetch "cd /opt/llmfetch && git pull && npm install && npm run build"
ssh llmfetch "cd /opt/llmfetch && npm test"
ssh llmfetch "cd /opt/llmfetch && npm run benchmark -- --urls data/urls-10k.txt --db results.db --parallel 100"
ssh llmfetch "cd /opt/llmfetch && npm run benchmark:report -- --db results.db"
```

## Constraints

1. **NEVER fetch URLs from local machine** - only from remote server (65.108.57.35)
2. **No stack constraints** - use whatever language/libraries achieve the targets

## Current State

- Basic TypeScript implementation exists
- Benchmark infrastructure works
- 9 tests passing
- First benchmark in progress

## Benchmark History

| Date | Success% | URLs/sec | p95 | p50 | Memory | Notes |
|------|----------|----------|-----|-----|--------|-------|
| 2025-01-15 | 2.9% | ~10 | 4913ms | 2529ms | ~1.4GB | Baseline - 96% errors (759 timeouts, 158 DNS) |

## Known Issues from Baseline

From first 1000 URLs:
- **759 timeouts (76%)** - 10s timeout too short OR network issues
- **158 DNS errors (16%)** - many Tranco URLs are dead/parked domains
- **20 SSL errors** - sites with bad certs
- **12 no_content** - extraction returning empty
- **p50 latency 2529ms** - way too slow (target: 500ms)
- **Success rate 2.9%** - target is 80%

Root causes to investigate:
1. Timeout handling - maybe increase to 15-30s?
2. URL list quality - filter out dead domains?
3. DNS resolution speed
4. Connection pooling / HTTP client efficiency

## Iteration Loop

```
while criteria_not_met:
    1. Run benchmark
    2. Measure against criteria
    3. Identify biggest gap
    4. Fix/improve
    5. Repeat
```

## Exit Conditions

Set EXIT_READY: true when:
- All 7 criteria marked [x] in table above
- Verified by running benchmark:report
- npm test passes
