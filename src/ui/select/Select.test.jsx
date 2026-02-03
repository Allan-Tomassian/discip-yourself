import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { computeSelectPosition } from "./Select";

describe("computeSelectPosition", () => {
  it("positions below anchor by default and clamps within viewport", () => {
    const rect = { left: 100, right: 220, top: 40, bottom: 60, width: 120, height: 20 };
    const menuRect = { width: 160, height: 200 };
    const viewport = { width: 800, height: 600 };
    const pos = computeSelectPosition({ rect, menuRect, viewport });
    expect(pos.left).toBe(100);
    expect(pos.top).toBe(60);
    expect(pos.width).toBe(120);
  });

  it("aligns right when overflowing viewport", () => {
    const rect = { left: 760, right: 820, top: 40, bottom: 60, width: 60, height: 20 };
    const menuRect = { width: 200, height: 160 };
    const viewport = { width: 800, height: 600 };
    const pos = computeSelectPosition({ rect, menuRect, viewport });
    expect(pos.left).toBe(732);
  });

  it("flips above when overflowing bottom", () => {
    const rect = { left: 100, right: 220, top: 520, bottom: 540, width: 120, height: 20 };
    const menuRect = { width: 140, height: 120 };
    const viewport = { width: 800, height: 600 };
    const pos = computeSelectPosition({ rect, menuRect, viewport });
    expect(pos.top).toBe(400);
  });

  it("keeps portal-backed dropdown logic centralized", () => {
    const root = process.cwd();
    const candidates = [
      path.resolve(root, "src/ui/select/Select.jsx"),
      path.resolve(root, "src/components/UI.jsx"),
    ];

    const portalFiles = candidates.filter((file) => {
      const content = fs.readFileSync(file, "utf8");
      return /\bcreatePortal\b|\bPortal\b/.test(content);
    });

    expect(portalFiles).toEqual([path.resolve(root, "src/ui/select/Select.jsx")]);
  });
});
