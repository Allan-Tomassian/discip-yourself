import React from "react";

export default function TodayValuePulse({
  title = "",
  meta = "",
  tone = "structure",
}) {
  if (!title) return null;

  return (
    <div
      className={`todayValuePulse is-${tone}`}
      data-testid="today-value-pulse"
    >
      <div className="todayValuePulseTitle">{title}</div>
      {meta ? <div className="todayValuePulseMeta">{meta}</div> : null}
    </div>
  );
}
