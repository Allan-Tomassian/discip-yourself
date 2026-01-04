import React from "react";
import { AccentContext } from "../components/UI";

export default function ScreenShell({
  accent = "#FFFFFF",
  backgroundCss = "",
  backgroundImage,
  headerTitle,
  headerSubtitle,
  headerRight,
  headerAlign = "left",
  children,
}) {
  const alignClass =
    headerAlign === "left"
      ? "pageHeaderAlignLeft"
      : headerAlign === "right"
        ? "pageHeaderAlignRight"
        : "pageHeaderAlignCenter";

  return (
    <AccentContext.Provider value={{ accent }}>
      {/* Background preset (gradient) */}
      <div className="bg" style={backgroundCss ? { backgroundImage: backgroundCss } : undefined} />

      {/* Optional image overlay */}
      {backgroundImage ? <div className="bgImg" style={{ backgroundImage: `url(${backgroundImage})` }} /> : null}

      <div className="container">
        <div className="pageHeader">
          <div className={`pageHeaderLeft ${alignClass}`}>
            <div className="pageTitle">{headerTitle}</div>
            <div className="pageSubtitle">{headerSubtitle}</div>
          </div>
          {headerRight ? <div className="pageHeaderRight">{headerRight}</div> : null}
        </div>
        <div className="pageContent">{children}</div>
      </div>
    </AccentContext.Provider>
  );
}
