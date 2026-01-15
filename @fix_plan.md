# llmfetch - Success Criteria Tracker

## Goal

Build the best web-to-markdown tool for LLMs. Fast, reliable, knows when to give up.

## Success Criteria Checklist

All 7 must be met to exit:

| # | Criteria | Target | Current | Status |
|---|----------|--------|---------|--------|
| 1 | Success Rate | ≥80% on 10K URLs | not_measured | [ ] |
| 2 | Throughput | ≥50 URLs/sec | not_measured | [ ] |
| 3 | Latency p95 | ≤2000ms | not_measured | [ ] |
| 4 | Latency p50 | ≤500ms | not_measured | [ ] |
| 5 | Content Quality (title) | ≥90% have title | not_measured | [ ] |
| 6 | Content Quality (words) | ≥90% have >100 words | not_measured | [ ] |
| 7 | Memory | <4GB during benchmark | not_measured | [ ] |
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
| TBD | TBD | TBD | TBD | TBD | TBD | First run |

## Known Issues to Investigate

1. Defuddle throws CSS selector errors on some sites
2. happy-dom XMLHttpRequest errors from third-party scripts
3. Need to verify results are being written to SQLite correctly

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
