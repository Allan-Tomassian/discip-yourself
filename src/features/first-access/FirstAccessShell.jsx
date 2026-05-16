import React from "react";
import "./firstAccess.css";

export default function FirstAccessShell({
  children,
  variant = "form",
  className = "",
  "data-testid": dataTestId,
}) {
  return (
    <main
      className={["firstAccessShell", `firstAccessShell--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      data-testid={dataTestId}
    >
      <div className="firstAccessBackdrop" aria-hidden="true">
        <span className="firstAccessGrid" />
        <span className="firstAccessBeam" />
        <span className="firstAccessPath" />
        <span className="firstAccessHalo" />
      </div>

      <div className="firstAccessViewport">
        <div className="firstAccessBrand" aria-label="Discip Yourself">
          <span className="firstAccessBrandMark" aria-hidden="true">
            <span />
          </span>
          <span className="firstAccessBrandText">
            <strong>Discip Yourself</strong>
            <span>Premium discipline command system</span>
          </span>
        </div>

        <div className="firstAccessContent">{children}</div>
      </div>
    </main>
  );
}
