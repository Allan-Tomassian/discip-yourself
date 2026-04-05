import React, { useMemo, useRef, useState } from "react";
import { AppPopoverMenu } from "./AppUI";

function ChevronIcon({ open = false }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className={open ? "lovableCompactFilterChevron is-open" : "lovableCompactFilterChevron"}
    >
      <path d="M4 6.5 8 10l4-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CompactCategoryFilter({
  label = "",
  options = [],
  value = "all",
  onChange,
  allLabel = "Toutes",
  className = "",
}) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const selectedOption = useMemo(() => {
    if (value === "all") return null;
    return options.find((option) => option?.id === value) || null;
  }, [options, value]);

  const triggerLabel = selectedOption?.label || allLabel;

  return (
    <div className={`lovableCompactFilter ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="lovableCompactFilterTrigger"
        aria-label={label || allLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="lovableCompactFilterValue">{triggerLabel}</span>
        <ChevronIcon open={open} />
      </button>

      <AppPopoverMenu
        open={open}
        anchorEl={triggerRef.current}
        anchorRect={triggerRef.current?.getBoundingClientRect?.() || null}
        onClose={() => setOpen(false)}
        ariaLabel={label || allLabel}
        panelClassName="lovableCompactFilterPanel"
      >
        <button
          type="button"
          className={`lovableCompactFilterOption${value === "all" ? " is-active" : ""}`}
          onClick={() => {
            onChange?.("all");
            setOpen(false);
          }}
        >
          <span>{allLabel}</span>
              {value === "all" ? <span className="lovableCompactFilterOptionMark">✓</span> : null}
        </button>

        {options.map((option) => {
          const active = option?.id === value;
          return (
            <button
              key={option.id}
              type="button"
              className={`lovableCompactFilterOption${active ? " is-active" : ""}`}
              onClick={() => {
                onChange?.(option.id);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {active ? <span className="lovableCompactFilterOptionMark">✓</span> : null}
            </button>
          );
        })}
      </AppPopoverMenu>
    </div>
  );
}
