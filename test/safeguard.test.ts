/**
 * Safeguard tests - verify external fetches are blocked locally
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the environment to simulate local machine (not VPS)
vi.stubEnv('HOSTNAME', 'macbook');
vi.stubEnv('USER', 'developer');
vi.stubEnv('VPS', '');
vi.stubEnv('LLMFETCH_VPS', '');

// Now import the safeguard - it should activate
import { enableSafeguard, isRunningOnVPS } from "../src/lib/safeguard.js";

describe("safeguard", () => {
  beforeEach(() => {
    // Force enable for tests
    enableSafeguard();
  });

  it("detects local machine is not VPS", () => {
    expect(isRunningOnVPS()).toBe(false);
  });

  it("blocks fetch to external URLs", async () => {
    await expect(fetch("https://example.com")).rejects.toThrow("BLOCKED:");
  });

  it("blocks fetch to google.com", async () => {
    await expect(fetch("https://google.com")).rejects.toThrow("BLOCKED:");
  });

  it("allows fetch to localhost", async () => {
    // This should not throw (though it may fail to connect)
    try {
      await fetch("http://localhost:9999/test");
    } catch (e) {
      // Connection refused is fine - the point is it wasn't BLOCKED
      expect(String(e)).not.toContain("BLOCKED:");
    }
  });

  it("allows fetch to 127.0.0.1", async () => {
    try {
      await fetch("http://127.0.0.1:9999/test");
    } catch (e) {
      expect(String(e)).not.toContain("BLOCKED:");
    }
  });
});
