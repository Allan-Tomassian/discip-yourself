import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TodayHeader from "./TodayHeader";

describe("TodayHeader", () => {
  it("renders the notification center button beside the avatar", () => {
    const html = renderToStaticMarkup(
      <TodayHeader
        dateLabel="vendredi 22 mai"
        avatarLabel="Allan Test"
        notificationUnreadCount={12}
        onOpenNotifications={() => {}}
        onOpenProfile={() => {}}
      />,
    );

    expect(html).toContain("todayCockpitHeaderActions");
    expect(html).toContain("todayCockpitNotificationButton");
    expect(html).toContain("9+");
    expect(html).toContain("Ouvrir les notifications, 12 non lues");
    expect(html).toContain("Ouvrir le menu du profil");
  });

  it("keeps profile and notification actions separate", () => {
    const onOpenNotifications = vi.fn();
    const onOpenProfile = vi.fn();
    const element = TodayHeader({
      avatarLabel: "Allan Test",
      notificationUnreadCount: 1,
      onOpenNotifications,
      onOpenProfile,
    });
    const actions = element.props.children[1];
    const buttons = React.Children.toArray(actions.props.children);

    buttons[0].props.onClick();
    buttons[1].props.onClick();

    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });
});
