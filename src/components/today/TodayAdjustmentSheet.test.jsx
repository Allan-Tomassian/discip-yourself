import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TodayAdjustmentSheet from "./TodayAdjustmentSheet";

function getSheetContent(element) {
  return element.props.children;
}

describe("TodayAdjustmentSheet", () => {
  it("renders an explicit visible close action", () => {
    const html = renderToStaticMarkup(<TodayAdjustmentSheet open onClose={() => {}} />);

    expect(html).toContain("Ajuster");
    expect(html).toContain("Fermer");
    expect(html).toContain("Adapter la journée sans recréer un plan à la main.");
  });

  it("calls the existing close callback from the header action", () => {
    const onClose = vi.fn();
    const element = TodayAdjustmentSheet({ open: true, onClose });
    const closeAction = getSheetContent(element).props.actions;

    closeAction.props.onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves the existing adjustment callbacks", () => {
    const callbacks = {
      onSimplify: vi.fn(),
      onReorganize: vi.fn(),
      onReduce: vi.fn(),
      onAskCoach: vi.fn(),
    };
    const element = TodayAdjustmentSheet({ open: true, onClose: vi.fn(), ...callbacks });
    const actionList = getSheetContent(element).props.children;
    const buttons = React.Children.toArray(actionList.props.children);

    buttons.forEach((button) => button.props.onClick());

    expect(callbacks.onSimplify).toHaveBeenCalledTimes(1);
    expect(callbacks.onReorganize).toHaveBeenCalledTimes(1);
    expect(callbacks.onReduce).toHaveBeenCalledTimes(1);
    expect(callbacks.onAskCoach).toHaveBeenCalledTimes(1);
  });
});
