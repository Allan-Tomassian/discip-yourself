import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ProfileMenu from "./ProfileMenu";

function getSheetContent(element) {
  return element.props.children;
}

describe("ProfileMenu", () => {
  it("renders an explicit visible close action", () => {
    const html = renderToStaticMarkup(<ProfileMenu open onClose={() => {}} />);

    expect(html).toContain("Profil");
    expect(html).toContain("Fermer");
    expect(html).toContain("Gérer ton compte et ton accès.");
  });

  it("calls the existing close callback from the header action", () => {
    const onClose = vi.fn();
    const element = ProfileMenu({ open: true, onClose });
    const closeAction = getSheetContent(element).props.actions;

    closeAction.props.onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps profile navigation and sign-out actions working", () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    const onSignOut = vi.fn();
    const element = ProfileMenu({ open: true, onClose, onNavigate, onSignOut });
    const menu = getSheetContent(element).props.children;
    const buttons = React.Children.toArray(menu.props.children);

    buttons[0].props.onClick();
    buttons[4].props.onClick();

    expect(onNavigate).toHaveBeenCalledWith("account");
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
