import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TodayTimeline from "./TodayTimeline";

const STATUS_ITEMS = [
  { id: "done", timeLabel: "07:00", title: "Routine", status: "done" },
  { id: "active", timeLabel: "09:00", title: "Focus", status: "in_progress" },
  { id: "upcoming", timeLabel: "13:00", title: "Deep work", status: "upcoming" },
  { id: "late", timeLabel: "14:00", title: "Late block", status: "late" },
  { id: "missed", timeLabel: "15:00", title: "Missed block", status: "missed" },
  { id: "blocked", timeLabel: "16:00", title: "Blocked block", status: "blocked" },
  { id: "reported", timeLabel: "17:00", title: "Reported block", status: "reported" },
  { id: "postponed", timeLabel: "18:00", title: "Postponed block", status: "postponed" },
];

function findAllByType(node, type) {
  if (!node || typeof node !== "object") return [];
  const matches = node.type === type ? [node] : [];
  return matches.concat(React.Children.toArray(node.props?.children).flatMap((child) => findAllByType(child, type)));
}

describe("TodayTimeline", () => {
  it("renders the premium timeline background and coded dynamic nodes", () => {
    const html = renderToStaticMarkup(
      <TodayTimeline items={STATUS_ITEMS.slice(0, 3)} progressLabel="67%" />
    );

    expect(html).toContain("todayTimelineBackdrop");
    expect(html).toContain("todayTimelineRail");
    expect(html).toContain("67% complété");
    expect(html).toContain("Routine");
    expect(html).toContain("Focus");
    expect(html).toContain("Deep work");
    expect(html).toContain("todayTimelineSummary");
    expect(html).not.toContain("<img");
  });

  it("maps supported statuses to dynamic tones and terminal metadata", () => {
    const html = STATUS_ITEMS.map((item) =>
      renderToStaticMarkup(<TodayTimeline items={[item]} progressLabel="50%" />)
    ).join("");

    expect(html).toContain('data-status="done"');
    expect(html).toContain('data-tone="done"');
    expect(html).toContain('data-status="in_progress"');
    expect(html).toContain('data-tone="active"');
    expect(html).toContain('data-status="upcoming"');
    expect(html).toContain('data-tone="upcoming"');
    expect(html).toContain('data-status="late"');
    expect(html).toContain('data-tone="risk"');
    expect(html).toContain('data-status="missed"');
    expect(html).toContain('data-status="blocked"');
    expect(html).toContain('data-status="reported"');
    expect(html).toContain('data-status="postponed"');
    expect(html).toContain('data-terminal="true"');
    expect(html).toContain('data-launchable="false"');
    expect(html).toContain("En cours");
  });

  it("caps the compact strip at three priority nodes and summarizes hidden blocks", () => {
    const element = TodayTimeline({ items: STATUS_ITEMS.slice(0, 6), progressLabel: "50%" });
    const buttons = findAllByType(element, "button");
    const html = renderToStaticMarkup(element);

    expect(buttons).toHaveLength(3);
    expect(html).toContain("+3 blocs");
  });

  it("anchors active work before other timeline states", () => {
    const html = renderToStaticMarkup(
      <TodayTimeline items={[STATUS_ITEMS[0], STATUS_ITEMS[1], STATUS_ITEMS[2], STATUS_ITEMS[3]]} />
    );

    expect(html).toContain('data-status="in_progress"');
    expect(html).toContain('data-anchor="true"');
    expect(html).toContain("Focus est en cours.");
  });

  it("shows problem and next states clearly without exceeding the compact strip", () => {
    const element = TodayTimeline({
      items: [
        { id: "done", timeLabel: "07:00", title: "Routine", status: "done" },
        { id: "missed", timeLabel: "10:00", title: "Test inscription", status: "missed" },
        { id: "next", timeLabel: "18:00", title: "Rituel personnel", status: "upcoming" },
        { id: "later", timeLabel: "20:00", title: "Lecture", status: "upcoming" },
      ],
    });
    const html = renderToStaticMarkup(element);

    expect(findAllByType(element, "button")).toHaveLength(3);
    expect(html).toContain('data-status="missed"');
    expect(html).toContain('data-anchor="true"');
    expect(html).toContain("Manqué");
    expect(html).toContain('data-status="upcoming"');
    expect(html).toContain("Un bloc est manqué. Reprends sans dette.");
  });

  it("renders all-done days as a completion summary with the last nodes", () => {
    const html = renderToStaticMarkup(
      <TodayTimeline
        progressLabel="100%"
        items={[
          { id: "done-1", timeLabel: "07:00", title: "Routine", status: "done" },
          { id: "done-2", timeLabel: "09:00", title: "Focus", status: "done" },
          { id: "done-3", timeLabel: "13:00", title: "Sport", status: "done" },
          { id: "done-4", timeLabel: "18:00", title: "Lecture", status: "done" },
        ]}
      />
    );

    expect(html).toContain("Journée complétée.");
    expect(html).toContain("+1 bloc");
    expect(html).not.toContain("Routine");
    expect(html).toContain("Lecture");
  });

  it("filters canceled and skipped items defensively", () => {
    const html = renderToStaticMarkup(
      <TodayTimeline
        items={[
          { id: "canceled", timeLabel: "10:00", title: "Canceled", status: "canceled" },
          { id: "skipped", timeLabel: "11:00", title: "Skipped", status: "skipped" },
          { id: "upcoming", timeLabel: "12:00", title: "Visible", status: "upcoming" },
        ]}
      />
    );

    expect(html).toContain("Visible");
    expect(html).not.toContain("Canceled");
    expect(html).not.toContain("Skipped");
  });

  it("renders calm disabled placeholders without fake nodes", () => {
    const html = renderToStaticMarkup(<TodayTimeline items={[]} timelineMode="empty" />);

    expect(html).toContain("today-timeline-placeholder");
    expect(html).toContain("Planning à structurer");
    expect(html).not.toContain("todayTimelinePoint");
    expect(html).not.toContain("todayTimelineRail");
  });

  it("keeps existing Planning routing for real timeline items", () => {
    const onSelectItem = vi.fn();
    const element = TodayTimeline({ items: [STATUS_ITEMS[0]], onSelectItem });
    const button = findAllByType(element, "button")[0];

    button.props.onClick();

    expect(onSelectItem).toHaveBeenCalledWith(expect.objectContaining({ id: "done", status: "done" }));
  });
});
