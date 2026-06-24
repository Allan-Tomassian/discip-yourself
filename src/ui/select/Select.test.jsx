import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { computeSelectPosition } from "./selectPosition";

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

  it("supports opt-in popup sizing without compressing to a narrow trigger", () => {
    const rect = { left: 20, right: 140, top: 40, bottom: 60, width: 120, height: 20 };
    const menuRect = { width: 120, height: 260 };
    const viewport = { width: 360, height: 720 };
    const pos = computeSelectPosition({
      rect,
      menuRect,
      viewport,
      preferredWidth: 320,
      minWidth: 304,
      maxWidth: 360,
    });

    expect(pos.left).toBe(20);
    expect(pos.width).toBe(320);
    expect(pos.minWidth).toBe(320);
  });

  it("caps opt-in popup sizing to the mobile viewport safe width", () => {
    const rect = { left: 16, right: 116, top: 40, bottom: 60, width: 100, height: 20 };
    const menuRect = { width: 100, height: 260 };
    const viewport = { width: 300, height: 720 };
    const pos = computeSelectPosition({
      rect,
      menuRect,
      viewport,
      preferredWidth: 320,
      minWidth: 304,
      maxWidth: 360,
    });

    expect(pos.left).toBe(8);
    expect(pos.width).toBe(284);
    expect(pos.maxWidth).toBe(284);
  });

  it("flips above when overflowing bottom", () => {
    const rect = { left: 100, right: 220, top: 520, bottom: 540, width: 120, height: 20 };
    const menuRect = { width: 140, height: 120 };
    const viewport = { width: 800, height: 600 };
    const pos = computeSelectPosition({ rect, menuRect, viewport });
    expect(pos.top).toBe(400);
  });

  it("keeps portal-backed dropdown logic centralized", () => {
    const candidates = [fileURLToPath(new URL("./Select.jsx", import.meta.url))];

    const portalFiles = candidates.filter((file) => {
      const content = fs.readFileSync(file, "utf8");
      return /\bcreatePortal\b|\bPortal\b/.test(content);
    });

    expect(portalFiles).toEqual(candidates);
  });
});
