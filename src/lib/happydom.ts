/**
 * Tier 1: JavaScript execution using happy-dom
 *
 * NOTE: happy-dom leaks memory. In production, this should run in a
 * Worker thread that gets recycled after N requests.
 * For now, this is a simple implementation with robust error handling.
 */

import { Window } from "happy-dom";

/**
 * Execute JavaScript in HTML and return the resulting HTML
 * Returns original HTML if execution fails
 */
export async function executeJs(
  html: string,
  url: string,
  timeout: number = 3000
): Promise<string> {
  let window: Window | null = null;

  try {
    // Create window with settings to prevent network requests from throwing
    window = new Window({
      url,
      settings: {
        disableJavaScriptFileLoading: true,
        disableCSSFileLoading: true,
        disableComputedStyleRendering: true,
        navigator: {
          userAgent: "llmfetch/0.1",
        },
      },
    });

    // Suppress console errors from scripts
    window.console.error = () => {};
    window.console.warn = () => {};

    // Load the HTML
    window.document.write(html);

    // Wait for content to appear with a promise race against timeout
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const textContent = window.document.body?.textContent?.trim() || "";
      if (textContent.length > 100) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    // Return the resulting HTML
    return window.document.documentElement.outerHTML;
  } catch {
    // On any error, return original HTML
    return html;
  } finally {
    // Clean up safely
    if (window) {
      try {
        await window.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
