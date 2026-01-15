/**
 * Tier 1: JavaScript execution using happy-dom
 *
 * NOTE: happy-dom leaks memory. In production, this should run in a
 * Worker thread that gets recycled after N requests.
 * For now, this is a simple implementation.
 */

import { Window } from "happy-dom";

/**
 * Execute JavaScript in HTML and return the resulting HTML
 */
export async function executeJs(
  html: string,
  url: string,
  timeout: number = 3000
): Promise<string> {
  const window = new Window({ url });

  try {
    // Load the HTML
    window.document.write(html);

    // Wait for content to appear
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
  } finally {
    // Clean up
    await window.close();
  }
}
