/**
 * Core fetch logic - Tier 0 (simple HTTP fetch)
 */

import { request } from "undici";
import { extractContent } from "./parse.js";
import { analyzeResponse, detectBlockPage, needsJavaScript } from "./detect.js";
import { executeJs } from "./happydom.js";

// Create an abort signal that times out
function createTimeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export interface FetchOptions {
  timeout?: number;
  useCache?: boolean;
  debug?: boolean;
  skipTier1?: boolean; // Skip happy-dom for faster benchmarking
}

export interface FetchResult {
  url: string;
  content?: string;
  title?: string;
  author?: string;
  published?: string;
  wordCount?: number;
  tokenCount?: number;
  tier: 0 | 1;
  cached: boolean;
  latencyMs: number;
  error?: string;
  reason?: string;
}

/**
 * Fetch a URL and extract content as markdown
 */
export async function fetchAndParse(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { timeout = 5000, debug = false, skipTier1 = false } = options; // 5s default for speed
  const startTime = Date.now();

  // Normalize URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    // Tier 0: Simple HTTP fetch with strict timeout
    const signal = createTimeoutSignal(timeout);
    const response = await request(url, {
      method: "GET",
      headers: {
        "User-Agent": "llmfetch/0.1 (https://github.com/mrmps/freescrape)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      maxRedirections: 5,
      headersTimeout: timeout,
      bodyTimeout: timeout,
      signal,
    });

    const html = await response.body.text();
    const latencyMs = Date.now() - startTime;

    if (debug) {
      console.error(`[debug] Fetched ${url} in ${latencyMs}ms, status ${response.statusCode}`);
    }

    // Check for block response (403, 429, etc.)
    const blockResult = analyzeResponse(
      response.statusCode,
      response.headers as Record<string, string>,
      html
    );
    if (blockResult) {
      return {
        url,
        tier: 0,
        cached: false,
        latencyMs,
        error: "BLOCKED",
        reason: blockResult.reason,
      };
    }

    // Extract content with Defuddle
    const extracted = await extractContent(html, url);

    if (extracted && extracted.content && extracted.content.length > 100) {
      // Success at Tier 0
      return {
        url,
        content: extracted.content,
        title: extracted.title,
        author: extracted.author,
        published: extracted.published,
        wordCount: extracted.wordCount,
        tokenCount: Math.ceil(extracted.wordCount * 1.3), // rough estimate
        tier: 0,
        cached: false,
        latencyMs,
      };
    }

    // Check if it's a block page we missed
    const blockPage = detectBlockPage(html);
    if (blockPage) {
      return {
        url,
        tier: 0,
        cached: false,
        latencyMs,
        error: "BLOCKED",
        reason: blockPage.reason,
      };
    }

    // Check if we need JavaScript
    if (needsJavaScript(html, extracted?.content ?? null)) {
      // Skip Tier 1 for fast benchmarking
      if (skipTier1) {
        return {
          url,
          tier: 0,
          cached: false,
          latencyMs: Date.now() - startTime,
          error: "NEEDS_JS",
          reason: "spa_skipped",
        };
      }

      if (debug) {
        console.error(`[debug] Escalating to Tier 1 (happy-dom)`);
      }

      // Tier 1: Execute JavaScript with happy-dom
      const jsHtml = await executeJs(html, url, 3000);
      const jsExtracted = await extractContent(jsHtml, url);

      if (jsExtracted && jsExtracted.content && jsExtracted.content.length > 100) {
        return {
          url,
          content: jsExtracted.content,
          title: jsExtracted.title,
          author: jsExtracted.author,
          published: jsExtracted.published,
          wordCount: jsExtracted.wordCount,
          tokenCount: Math.ceil(jsExtracted.wordCount * 1.3),
          tier: 1,
          cached: false,
          latencyMs: Date.now() - startTime,
        };
      }

      // Tier 1 also failed
      return {
        url,
        tier: 1,
        cached: false,
        latencyMs: Date.now() - startTime,
        error: "BLOCKED",
        reason: "spa_failed",
      };
    }

    // No content and doesn't look like it needs JS
    return {
      url,
      tier: 0,
      cached: false,
      latencyMs,
      error: "EMPTY",
      reason: "no_content",
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const error = err as Error;

    // Classify the error
    let reason = "unknown";
    const msg = error.message || String(error);
    if (error.name === "AbortError" || msg.includes("aborted") || msg.includes("ETIMEDOUT") || msg.includes("timeout")) {
      reason = "timeout";
    } else if (msg.includes("ENOTFOUND")) {
      reason = "dns_error";
    } else if (msg.includes("ECONNREFUSED")) {
      reason = "connection_refused";
    } else if (msg.includes("ECONNRESET")) {
      reason = "connection_reset";
    } else if (msg.includes("certificate") || msg.includes("SSL") || msg.includes("TLS")) {
      reason = "ssl_error";
    }

    return {
      url,
      tier: 0,
      cached: false,
      latencyMs,
      error: "ERROR",
      reason,
    };
  }
}
