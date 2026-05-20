import { describe, expect, it, vi } from "vitest";
import { openPaywallLegalLink } from "./paywallModalNavigation";

describe("PaywallModal navigation safety", () => {
  it("closes the paywall before opening legal routes", () => {
    const calls = [];
    const onClose = vi.fn(() => calls.push("close"));
    const onOpen = vi.fn(() => calls.push("open"));

    openPaywallLegalLink({ onClose, onOpen });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["close", "open"]);
  });

  it("is safe when a legal route callback is absent", () => {
    const onClose = vi.fn();

    expect(() => openPaywallLegalLink({ onClose })).not.toThrow();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
