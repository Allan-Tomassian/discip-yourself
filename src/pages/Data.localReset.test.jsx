import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Data, {
  DataLocalResetConfirmationContent,
  DataLocalResetSection,
} from "./Data";
import { LOCAL_DATA_RESET_COPY } from "./localDataResetModel";

function findAll(node, predicate) {
  const matches = [];
  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!React.isValidElement(current)) return;
    if (predicate(current)) matches.push(current);
    React.Children.toArray(current.props?.children).forEach(visit);
  }
  visit(node);
  return matches;
}

function nodeText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (!React.isValidElement(node)) return "";
  return React.Children.toArray(node.props?.children).map(nodeText).join("");
}

describe("Data local reset controls", () => {
  it("hides the test zone in production env", () => {
    const html = renderToStaticMarkup(
      <Data
        data={{ profile: { plan: "premium" } }}
        resetEnvironment={{ appEnv: "production", mode: "production", prod: true, dev: false }}
      />
    );

    expect(html).not.toContain(LOCAL_DATA_RESET_COPY.sectionTitle);
    expect(html).not.toContain(LOCAL_DATA_RESET_COPY.resetLabel);
  });

  it("shows the test zone in local and staging envs", () => {
    const localHtml = renderToStaticMarkup(
      <Data
        data={{ profile: { plan: "premium" } }}
        resetEnvironment={{ appEnv: "local", mode: "development", dev: true, prod: false }}
      />
    );
    const stagingHtml = renderToStaticMarkup(
      <Data
        data={{ profile: { plan: "premium" } }}
        resetEnvironment={{ appEnv: "staging", mode: "production", dev: false, prod: true }}
      />
    );

    expect(localHtml).toContain(LOCAL_DATA_RESET_COPY.sectionTitle);
    expect(localHtml).toContain(LOCAL_DATA_RESET_COPY.resetLabel);
    expect(stagingHtml).toContain(LOCAL_DATA_RESET_COPY.sectionTitle);
    expect(stagingHtml).toContain(LOCAL_DATA_RESET_COPY.logoutResetLabel);
  });

  it("clicking reset buttons only requests confirmation", () => {
    const onRequestReset = vi.fn();
    const tree = DataLocalResetSection({ onRequestReset });
    const buttons = findAll(tree, (node) => typeof node.props?.onClick === "function");

    buttons.find((button) => nodeText(button) === LOCAL_DATA_RESET_COPY.resetLabel).props.onClick();
    buttons.find((button) => nodeText(button) === LOCAL_DATA_RESET_COPY.logoutResetLabel).props.onClick();

    expect(onRequestReset).toHaveBeenNthCalledWith(1, "local");
    expect(onRequestReset).toHaveBeenNthCalledWith(2, "logout");
  });

  it("cancel confirmation does not confirm or clear data", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const tree = DataLocalResetConfirmationContent({
      resetType: "local",
      onCancel,
      onConfirm,
    });
    const buttons = findAll(tree, (node) => typeof node.props?.onClick === "function");

    buttons.find((button) => nodeText(button) === LOCAL_DATA_RESET_COPY.cancel).props.onClick();

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirm button calls the reset confirmation callback and keeps explicit copy", () => {
    const onConfirm = vi.fn();
    const tree = DataLocalResetConfirmationContent({
      resetType: "logout",
      onCancel: () => {},
      onConfirm,
    });
    const buttons = findAll(tree, (node) => typeof node.props?.onClick === "function");

    expect(nodeText(tree)).toContain(LOCAL_DATA_RESET_COPY.notice);
    buttons.find((button) => nodeText(button) === LOCAL_DATA_RESET_COPY.confirmLogoutResetCta).props.onClick();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
