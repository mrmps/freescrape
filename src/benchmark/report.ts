/**
 * Benchmark reporter - generate stats from results database
 *
 * Usage:
 *   npm run benchmark:report -- --db results.db
 */

import { parseArgs } from "node:util";
import Database from "better-sqlite3";

async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: "string", short: "d", default: "results.db" },
      json: { type: "boolean", short: "j", default: false },
      compare: { type: "string", short: "c" },
    },
  });

  const db = new Database(values.db!, { readonly: true });

  const stats = generateStats(db);

  if (values.json) {
    console.log(JSON.stringify(stats, null, 2));
  } else {
    printReport(stats);
  }

  if (values.compare) {
    const compareDb = new Database(values.compare, { readonly: true });
    const compareStats = generateStats(compareDb);
    printComparison(stats, compareStats);
    compareDb.close();
  }

  db.close();
}

interface Stats {
  total: number;
  success: number;
  blocked: number;
  errors: number;
  successRate: number;
  tierDistribution: {
    tier0: number;
    tier1: number;
  };
  blockReasons: Record<string, number>;
  errorReasons: Record<string, number>;
  contentQuality: {
    hasTitle: number;
    over100Words: number;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}

function generateStats(db: Database.Database): Stats {
  const total = db.prepare("SELECT COUNT(*) as count FROM results").get() as { count: number };
  const success = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'success'").get() as { count: number };
  const blocked = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'BLOCKED'").get() as { count: number };

  const tier0 = db.prepare("SELECT COUNT(*) as count FROM results WHERE tier = 0").get() as { count: number };
  const tier1 = db.prepare("SELECT COUNT(*) as count FROM results WHERE tier = 1").get() as { count: number };

  const blockReasons = db
    .prepare("SELECT block_reason, COUNT(*) as count FROM results WHERE status = 'BLOCKED' GROUP BY block_reason")
    .all() as { block_reason: string; count: number }[];

  const errorReasons = db
    .prepare("SELECT block_reason, COUNT(*) as count FROM results WHERE status NOT IN ('success', 'BLOCKED') GROUP BY block_reason")
    .all() as { block_reason: string; count: number }[];

  const hasTitle = db.prepare("SELECT COUNT(*) as count FROM results WHERE has_title = 1").get() as { count: number };
  const over100Words = db.prepare("SELECT COUNT(*) as count FROM results WHERE word_count > 100").get() as { count: number };

  // Latency percentiles
  const latencies = db
    .prepare("SELECT latency_ms FROM results WHERE status = 'success' ORDER BY latency_ms")
    .all() as { latency_ms: number }[];

  const p50 = latencies[Math.floor(latencies.length * 0.5)]?.latency_ms || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)]?.latency_ms || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)]?.latency_ms || 0;

  return {
    total: total.count,
    success: success.count,
    blocked: blocked.count,
    errors: total.count - success.count - blocked.count,
    successRate: (success.count / total.count) * 100,
    tierDistribution: {
      tier0: tier0.count,
      tier1: tier1.count,
    },
    blockReasons: Object.fromEntries(blockReasons.map((r) => [r.block_reason || "unknown", r.count])),
    errorReasons: Object.fromEntries(errorReasons.map((r) => [r.block_reason || "unknown", r.count])),
    contentQuality: {
      hasTitle: hasTitle.count,
      over100Words: over100Words.count,
    },
    latency: { p50, p95, p99 },
  };
}

function printReport(stats: Stats) {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("                    BENCHMARK REPORT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log(`Total URLs:        ${stats.total.toLocaleString()}`);
  console.log(`Success:           ${stats.success.toLocaleString()} (${stats.successRate.toFixed(1)}%)`);
  console.log(`Blocked:           ${stats.blocked.toLocaleString()} (${((stats.blocked / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Errors:            ${stats.errors.toLocaleString()} (${((stats.errors / stats.total) * 100).toFixed(1)}%)`);
  console.log();
  console.log("Tier Distribution:");
  console.log(`  Tier 0:          ${stats.tierDistribution.tier0.toLocaleString()} (${((stats.tierDistribution.tier0 / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Tier 1:          ${stats.tierDistribution.tier1.toLocaleString()} (${((stats.tierDistribution.tier1 / stats.total) * 100).toFixed(1)}%)`);
  console.log();
  console.log("Block Reasons:");
  for (const [reason, count] of Object.entries(stats.blockReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(18)} ${count.toLocaleString()}`);
  }
  console.log();
  console.log("Error Reasons:");
  for (const [reason, count] of Object.entries(stats.errorReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(18)} ${count.toLocaleString()}`);
  }
  console.log();
  console.log("Content Quality (of successes):");
  console.log(`  Has title:       ${stats.contentQuality.hasTitle.toLocaleString()} (${((stats.contentQuality.hasTitle / stats.success) * 100).toFixed(1)}%)`);
  console.log(`  >100 words:      ${stats.contentQuality.over100Words.toLocaleString()} (${((stats.contentQuality.over100Words / stats.success) * 100).toFixed(1)}%)`);
  console.log();
  console.log("Latency:");
  console.log(`  p50:             ${stats.latency.p50}ms`);
  console.log(`  p95:             ${stats.latency.p95}ms`);
  console.log(`  p99:             ${stats.latency.p99}ms`);
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
}

function printComparison(current: Stats, baseline: Stats) {
  console.log();
  console.log("COMPARISON vs BASELINE:");
  const delta = (a: number, b: number) => {
    const diff = a - b;
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(1)}`;
  };
  console.log(`  Success rate:    ${delta(current.successRate, baseline.successRate)}%`);
  console.log(`  p95 latency:     ${delta(current.latency.p95, baseline.latency.p95)}ms`);
}

main().catch(console.error);
