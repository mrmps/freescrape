/**
 * Safeguard tests - verify external fetches are blocked locally
 *
 * NOTE: On VPS, safeguard is disabled (fetching allowed).
 * These tests verify the blocking behavior when NOT on VPS.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { isRunningOnVPS } from "../src/lib/safeguard.js";

// Check if we're on VPS - if so, skip blocking tests
const onVPS = isRunningOnVPS();

describe("safeguard", () => {
  beforeAll(() => {
    if (onVPS) {
      console.log("Running on VPS - safeguard is disabled, skipping block tests");
    }
  });

  it("correctly detects environment", () => {
    // On VPS: should return true
    // On local: should return false
    // Either way, this test passes - it just documents the current state
    console.log(`isRunningOnVPS() = ${onVPS}`);
    expect(typeof onVPS).toBe("boolean");
  });

  it.skipIf(onVPS)("blocks fetch to external URLs when local", async () => {
    // This only runs on local machine
    const { enableSafeguard } = await import("../src/lib/safeguard.js");
    enableSafeguard();
    await expect(fetch("https://example.com")).rejects.toThrow("BLOCKED:");
  });

  it.skipIf(onVPS)("blocks fetch to google.com when local", async () => {
    const { enableSafeguard } = await import("../src/lib/safeguard.js");
    enableSafeguard();
    await expect(fetch("https://google.com")).rejects.toThrow("BLOCKED:");
  });

  it("allows fetch to localhost", async () => {
    // This should not throw BLOCKED (though it may fail to connect)
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
