#!/usr/bin/env node
/**
 * llmfetch - Fast web-to-markdown CLI for LLMs
 *
 * Usage:
 *   llmfetch <url>                    Fetch URL and output markdown
 *   llmfetch <url> --format json      Output as JSON with metadata
 *   llmfetch <url> --max-tokens 2000  Limit output tokens
 *   llmfetch @urls.txt --parallel 10  Batch fetch from file
 */

import { Command } from "commander";
import { fetchAndParse } from "./lib/fetch.js";
import { version } from "./version.js";

const program = new Command();

program
  .name("llmfetch")
  .description("Fast web-to-markdown CLI for LLMs")
  .version(version)
  .argument("[url]", "URL to fetch")
  .option("-f, --format <format>", "Output format: md, json, text", "md")
  .option("-t, --max-tokens <n>", "Maximum tokens in output", parseInt)
  .option("-g, --grep <pattern>", "Filter content by regex pattern")
  .option("-s, --select <selector>", "CSS selector to extract")
  .option("-p, --parallel <n>", "Concurrent requests for batch mode", parseInt, 10)
  .option("--no-cache", "Bypass cache")
  .option("--timeout <ms>", "Request timeout in ms", parseInt, 10000)
  .option("--debug", "Enable debug output")
  .action(async (url, options) => {
    if (!url) {
      // Check if reading from stdin
      if (!process.stdin.isTTY) {
        // TODO: Batch mode from stdin
        console.error("Batch mode not yet implemented");
        process.exit(1);
      }
      program.help();
      return;
    }

    try {
      const result = await fetchAndParse(url, {
        timeout: options.timeout,
        useCache: options.cache,
        debug: options.debug,
      });

      if (result.error) {
        console.error(`Error: ${result.error} (${result.reason})`);
        process.exit(1);
      }

      if (options.format === "json") {
        console.log(JSON.stringify(result, null, 2));
      } else if (options.format === "text") {
        // Strip markdown formatting
        console.log(result.content?.replace(/[#*`\[\]]/g, "") ?? "");
      } else {
        console.log(result.content);
      }
    } catch (err) {
      console.error(`Fatal error: ${err}`);
      process.exit(1);
    }
  });

program.parse();
