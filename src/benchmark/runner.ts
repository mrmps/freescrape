/**
 * Benchmark runner - test against URL lists
 *
 * Usage:
 *   npm run benchmark -- --urls data/urls-10k.txt --db results.db --parallel 100
 */

import { parseArgs } from "node:util";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import Database from "better-sqlite3";
import { fetchAndParse } from "../lib/fetch.js";

interface BenchmarkOptions {
  urlsFile: string;
  dbFile: string;
  parallel: number;
  limit?: number;
}

async function main() {
  const { values } = parseArgs({
    options: {
      urls: { type: "string", short: "u" },
      db: { type: "string", short: "d", default: "results.db" },
      parallel: { type: "string", short: "p", default: "100" },
      limit: { type: "string", short: "l" },
    },
  });

  if (!values.urls) {
    console.error("Usage: npm run benchmark -- --urls <file> [--db <file>] [--parallel <n>]");
    process.exit(1);
  }

  const options: BenchmarkOptions = {
    urlsFile: values.urls,
    dbFile: values.db!,
    parallel: parseInt(values.parallel!, 10),
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
  };

  await runBenchmark(options);
}

async function runBenchmark(options: BenchmarkOptions) {
  console.log(`Starting benchmark...`);
  console.log(`  URLs file: ${options.urlsFile}`);
  console.log(`  Results DB: ${options.dbFile}`);
  console.log(`  Parallel: ${options.parallel}`);

  // Initialize database
  const db = new Database(options.dbFile);
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      url TEXT PRIMARY KEY,
      status TEXT,
      tier INTEGER,
      block_reason TEXT,
      has_title INTEGER,
      word_count INTEGER,
      token_count INTEGER,
      latency_ms INTEGER,
      timestamp INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_status ON results(status);
    CREATE INDEX IF NOT EXISTS idx_tier ON results(tier);
  `);

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO results
    (url, status, tier, block_reason, has_title, word_count, token_count, latency_ms, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const existsStmt = db.prepare(`SELECT 1 FROM results WHERE url = ?`);

  // Read URLs
  const urls: string[] = [];
  const rl = createInterface({
    input: createReadStream(options.urlsFile),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const url = line.trim();
    if (url && !url.startsWith("#")) {
      // Skip already tested URLs
      const exists = existsStmt.get(url);
      if (!exists) {
        urls.push(url);
        if (options.limit && urls.length >= options.limit) {
          break;
        }
      }
    }
  }

  console.log(`  URLs to test: ${urls.length}`);

  // Process in batches
  const startTime = Date.now();
  let completed = 0;
  let success = 0;
  let blocked = 0;
  let errors = 0;

  const processBatch = async (batch: string[]) => {
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          return await fetchAndParse(url, { timeout: 10000 });
        } catch (err) {
          return {
            url,
            tier: 0 as const,
            cached: false,
            latencyMs: 0,
            error: "EXCEPTION",
            reason: String(err),
          };
        }
      })
    );

    for (const result of results) {
      const status = result.error ? "error" : "success";
      if (status === "success") success++;
      else if (result.error === "BLOCKED") blocked++;
      else errors++;

      insertStmt.run(
        result.url,
        result.error ?? "success",
        result.tier,
        result.reason ?? null,
        result.title ? 1 : 0,
        result.wordCount ?? 0,
        result.tokenCount ?? 0,
        result.latencyMs,
        Date.now()
      );

      completed++;
    }

    // Progress
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const eta = (urls.length - completed) / rate;
    const pct = ((completed / urls.length) * 100).toFixed(1);
    const mem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);

    process.stdout.write(
      `\r  Progress: ${completed}/${urls.length} (${pct}%) | ` +
        `${rate.toFixed(1)} URLs/sec | ETA: ${formatTime(eta)} | ` +
        `Mem: ${mem}MB | S:${success} B:${blocked} E:${errors}`
    );
  };

  // Process URLs in parallel batches
  for (let i = 0; i < urls.length; i += options.parallel) {
    const batch = urls.slice(i, i + options.parallel);
    await processBatch(batch);
  }

  console.log("\n");
  console.log("Benchmark complete!");
  console.log(`  Total: ${completed}`);
  console.log(`  Success: ${success} (${((success / completed) * 100).toFixed(1)}%)`);
  console.log(`  Blocked: ${blocked} (${((blocked / completed) * 100).toFixed(1)}%)`);
  console.log(`  Errors: ${errors} (${((errors / completed) * 100).toFixed(1)}%)`);
  console.log(`  Time: ${formatTime((Date.now() - startTime) / 1000)}`);
  console.log(`  Rate: ${(completed / ((Date.now() - startTime) / 1000)).toFixed(1)} URLs/sec`);

  db.close();
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

main().catch(console.error);
