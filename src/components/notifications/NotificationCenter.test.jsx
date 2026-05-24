import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NotificationCenter from "./NotificationCenter";

const item = {
  notificationId: "notification-1",
  title: "C’est le moment",
  body: "Lance ton bloc.",
  ctaLabel: "Démarrer",
  deliveredAt: "2026-05-22T09:00:00.000Z",
  targetRoute: "/session/occ-1",
  status: "unread",
  routeable: true,
};

describe("NotificationCenter", () => {
  it("renders recent delivered notifications without native push claims", () => {
    const html = renderToStaticMarkup(<NotificationCenter open items={[item]} onClose={() => {}} />);

    expect(html).toContain("Notifications");
    expect(html).toContain("Historique récent dans l’app.");
    expect(html).toContain("C’est le moment");
    expect(html).toContain("Lance ton bloc.");
    expect(html).toContain("Démarrer");
    expect(html).not.toContain("push");
    expect(html).not.toContain("native");
    expect(html).not.toContain("APNs");
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(<NotificationCenter open items={[]} onClose={() => {}} />);

    expect(html).toContain("Aucune notification récente.");
  });

  it("wires close and routeable item actions", () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    const element = NotificationCenter({ open: true, items: [item], onClose, onAction });
    const content = element.props.children;
    const closeAction = content.props.actions;
    const list = content.props.children;
    const article = list.props.children[0];
    const actionButton = article.props.children[2];

    closeAction.props.onClick();
    actionButton.props.onClick();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(item);
  });
});
