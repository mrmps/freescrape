/**
 * Block detection tests
 */

import { describe, it, expect } from "vitest";
import { analyzeResponse, detectBlockPage, needsJavaScript } from "../src/lib/detect.js";

describe("analyzeResponse", () => {
  it("detects 403 as blocked", () => {
    const result = analyzeResponse(403, {}, "");
    expect(result?.blocked).toBe(true);
    expect(result?.reason).toBe("forbidden");
  });

  it("detects 429 as rate limited", () => {
    const result = analyzeResponse(429, {}, "");
    expect(result?.blocked).toBe(true);
    expect(result?.reason).toBe("rate_limited");
  });

  it("allows 200 OK", () => {
    const result = analyzeResponse(200, {}, "<html><body>Content</body></html>");
    expect(result).toBeNull();
  });
});

describe("detectBlockPage", () => {
  it("detects Cloudflare challenge", () => {
    const html = `
      <html>
        <head><title>Just a moment...</title></head>
        <body>Checking your browser before accessing the site.</body>
      </html>
    `;
    const result = detectBlockPage(html);
    expect(result?.blocked).toBe(true);
    expect(result?.reason).toBe("cloudflare");
  });

  it("detects reCAPTCHA", () => {
    const html = `
      <html>
        <body>
          <div class="g-recaptcha" data-sitekey="xxx"></div>
        </body>
      </html>
    `;
    const result = detectBlockPage(html);
    expect(result?.blocked).toBe(true);
    expect(result?.reason).toBe("captcha");
  });

  it("does not flag normal content", () => {
    const html = `
      <html>
        <body>
          <article>
            <h1>Welcome to my blog</h1>
            <p>This is normal content.</p>
          </article>
        </body>
      </html>
    `;
    const result = detectBlockPage(html);
    expect(result).toBeNull();
  });
});

describe("needsJavaScript", () => {
  it("returns false when content exists", () => {
    const html = "<html><body><p>Content</p></body></html>";
    const result = needsJavaScript(html, "This is extracted content that is long enough");
    expect(result).toBe(false);
  });

  it("returns true for empty React app", () => {
    const html = `
      <html>
        <body>
          <div id="root"></div>
          <script src="/static/js/main.js"></script>
        </body>
      </html>
    `;
    const result = needsJavaScript(html, null);
    expect(result).toBe(true);
  });

  it("returns false for Cloudflare (block, not SPA)", () => {
    const html = `
      <html>
        <head><title>Just a moment...</title></head>
        <body>Checking your browser</body>
      </html>
    `;
    const result = needsJavaScript(html, null);
    expect(result).toBe(false);
  });
});
