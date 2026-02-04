import React, { useId, useState } from "react";
import "./create.css";

export default function CreateSection({
  title,
  description,
  children,
  collapsible = true,
  defaultOpen = true,
}) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);

  const headerContent = (
    <>
      <div className="createSectionHeaderText">
        <div className="createSectionTitle">{title}</div>
        {description ? <div className="createSectionDesc">{description}</div> : null}
      </div>
      {collapsible ? (
        <span className="createSectionChevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      ) : null}
    </>
  );

  return (
    <section className={`createSection ${open ? "is-open" : "is-closed"}`}>
      {collapsible ? (
        <button
          type="button"
          className="createSectionHeader"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
        >
          {headerContent}
        </button>
      ) : (
        <div className="createSectionHeader createSectionHeaderStatic">{headerContent}</div>
      )}
      {!collapsible || open ? (
        <div id={contentId} className="createSectionBody">
          {children}
        </div>
      ) : null}
    </section>
  );
}
