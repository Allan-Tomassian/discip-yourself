import { describe, expect, it } from "vitest";
import { opensInlineMenuView } from "./topMenuViews";

describe("TopMenuPopover navigation", () => {
  it("keeps only true inline tools inside the popover", () => {
    expect(opensInlineMenuView("preferences")).toBe(true);
    expect(opensInlineMenuView("wallet")).toBe(true);
    expect(opensInlineMenuView("totem")).toBe(true);
    expect(opensInlineMenuView("subscription")).toBe(false);
    expect(opensInlineMenuView("data")).toBe(false);
    expect(opensInlineMenuView("support")).toBe(false);
  });
});
