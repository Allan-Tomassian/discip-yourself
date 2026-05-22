import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import InAppNudge from "./InAppNudge";

const nudge = {
  id: "nudge-1",
  title: "C’est le moment",
  body: "Lance ton bloc.",
  ctaLabel: "Démarrer",
};

describe("InAppNudge", () => {
  it("renders a non-modal nudge with title, body, CTA, and dismiss affordance", () => {
    const html = renderToStaticMarkup(<InAppNudge nudge={nudge} />);

    expect(html).toContain("inAppNudgeViewport");
    expect(html).toContain('role="status"');
    expect(html).toContain("C’est le moment");
    expect(html).toContain("Lance ton bloc.");
    expect(html).toContain("Démarrer");
    expect(html).toContain("Ignorer la notification");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("modal");
  });

  it("can offset on Home without changing its non-modal structure", () => {
    const html = renderToStaticMarkup(<InAppNudge nudge={nudge} placement="home" />);

    expect(html).toContain("inAppNudgeViewport is-home");
    expect(html).not.toContain('role="dialog"');
  });

  it("does not render without useful copy", () => {
    const html = renderToStaticMarkup(<InAppNudge nudge={{ id: "empty" }} />);

    expect(html).toBe("");
  });

  it("wires CTA and dismiss callbacks without mutation behavior", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    const element = InAppNudge({ nudge, onAction, onDismiss });
    const aside = element.props.children;
    const children = aside.props.children;
    const actionButton = children.find((child) => child?.props?.className === "inAppNudge__action");
    const dismissButton = children.find((child) => child?.props?.className === "inAppNudge__dismiss");

    actionButton.props.onClick();
    dismissButton.props.onClick();

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
