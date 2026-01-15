/**
 * Block detection - identify when we should give up (not escalate)
 */

export interface BlockResult {
  blocked: true;
  reason: string;
}

/**
 * Analyze HTTP response for block indicators
 */
export function analyzeResponse(
  status: number,
  headers: Record<string, string | string[] | undefined>,
  _html: string
): BlockResult | null {
  // Status code blocks
  if (status === 403) {
    return { blocked: true, reason: "forbidden" };
  }
  if (status === 429) {
    return { blocked: true, reason: "rate_limited" };
  }
  if (status === 503) {
    return { blocked: true, reason: "service_unavailable" };
  }
  if (status >= 500) {
    return { blocked: true, reason: "server_error" };
  }

  // Header-based detection
  const cfRay = headers["cf-ray"];
  const server = headers["server"];

  // Cloudflare with non-200 is suspicious
  if (cfRay && status !== 200) {
    return { blocked: true, reason: "cloudflare_block" };
  }

  // Akamai block
  if (server && typeof server === "string" && server.includes("AkamaiGHost")) {
    if (status !== 200) {
      return { blocked: true, reason: "akamai_block" };
    }
  }

  return null;
}

/**
 * Detect block pages by HTML content
 */
export function detectBlockPage(html: string): BlockResult | null {
  const lowerHtml = html.toLowerCase();

  // Cloudflare challenge patterns
  if (
    lowerHtml.includes("just a moment") ||
    lowerHtml.includes("checking your browser") ||
    lowerHtml.includes("cf-browser-verification") ||
    lowerHtml.includes("_cf_chl_opt") ||
    lowerHtml.includes("cloudflare ray id")
  ) {
    return { blocked: true, reason: "cloudflare" };
  }

  // CAPTCHA patterns
  if (
    lowerHtml.includes("recaptcha") ||
    lowerHtml.includes("hcaptcha") ||
    lowerHtml.includes("g-recaptcha") ||
    lowerHtml.includes("captcha-container")
  ) {
    return { blocked: true, reason: "captcha" };
  }

  // Generic WAF patterns
  if (
    lowerHtml.includes("access denied") ||
    lowerHtml.includes("request blocked") ||
    lowerHtml.includes("bot detected") ||
    lowerHtml.includes("automated access") ||
    lowerHtml.includes("security check")
  ) {
    return { blocked: true, reason: "waf" };
  }

  // PerimeterX
  if (lowerHtml.includes("perimeterx") || lowerHtml.includes("_pxhd")) {
    return { blocked: true, reason: "perimeterx" };
  }

  // DataDome
  if (lowerHtml.includes("datadome") || lowerHtml.includes("dd.js")) {
    return { blocked: true, reason: "datadome" };
  }

  return null;
}

/**
 * Determine if page needs JavaScript execution
 * Only returns true if it's NOT a block page
 */
export function needsJavaScript(
  html: string,
  extractedContent: string | null
): boolean {
  // If we got content, no need for JS
  if (extractedContent && extractedContent.length > 100) {
    return false;
  }

  // If it's a block page, don't escalate
  if (detectBlockPage(html)) {
    return false;
  }

  const lowerHtml = html.toLowerCase();

  // SPA indicators
  const spaPatterns = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<div id="__next"></div>',
    '<div id="__nuxt"></div>',
    "react-root",
    "vue-app",
    "angular-app",
  ];

  const hasSpaMarkers = spaPatterns.some((p) => lowerHtml.includes(p.toLowerCase()));

  // Has script tags
  const hasScripts = lowerHtml.includes("<script");

  // Body is mostly empty
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch?.[1] || "";
  const textContent = bodyContent.replace(/<[^>]+>/g, "").trim();
  const bodyIsEmpty = textContent.length < 200;

  return hasSpaMarkers && hasScripts && bodyIsEmpty;
}
