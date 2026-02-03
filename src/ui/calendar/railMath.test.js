import { describe, it, expect } from "vitest";
import { computeScrollPadding, computeTargetScrollLeftFromRects, indexAtCenter, targetScrollLeft } from "./railMath";

describe("railMath", () => {
  it("computes index at center with clamping", () => {
    const idx = indexAtCenter({
      scrollLeft: 0,
      containerWidth: 200,
      firstCenter: 100,
      stride: 50,
      count: 5,
    });
    expect(idx).toBe(0);
  });

  it("accounts for padding when finding center index", () => {
    const idx = indexAtCenter({
      scrollLeft: 0,
      containerWidth: 200,
      paddingLeft: 20,
      paddingRight: 10,
      firstCenter: 45,
      stride: 50,
      count: 5,
    });
    expect(idx).toBe(1);
  });

  it("computes target scrollLeft for index", () => {
    const left = targetScrollLeft({
      containerWidth: 200,
      firstCenter: 100,
      stride: 50,
      index: 2,
    });
    expect(left).toBe(100);
  });

  it("computes scroll padding from container and item width", () => {
    const sp = computeScrollPadding({ containerWidth: 200, itemWidth: 50 });
    expect(sp).toBe(75);
  });

  it("computes target scrollLeft from DOM rects", () => {
    const target = computeTargetScrollLeftFromRects({
      scrollLeft: 40,
      scrollerLeft: 10,
      scrollerWidth: 200,
      itemLeft: 90,
      itemWidth: 60,
    });
    expect(target).toBe(50);
  });
});
