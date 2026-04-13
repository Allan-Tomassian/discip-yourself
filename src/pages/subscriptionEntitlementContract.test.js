import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath) {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), "utf8");
}

describe("subscription entitlement contract", () => {
  it("reads the shared entitlement truth instead of deriving premium locally", () => {
    const app = readSrc("App.jsx");
    const subscription = readSrc("pages/Subscription.jsx");

    expect(app).toContain("<Subscription");
    expect(app).toContain("entitlementAccess={entitlementAccess}");
    expect(app).toContain("onRefreshEntitlement={ensureResolved}");
    expect(subscription).toContain("entitlementAccess = null");
    expect(subscription).not.toContain("isPremium(safeData)");
    expect(subscription).toContain('const status = access?.status || "unknown"');
    expect(subscription).toContain('const hasResolvedPremiumAccess = status === "premium" || status === "founder"');
  });
});
