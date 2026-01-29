import React from "react";
import AccentContext from "../components/AccentContext";

export default function ScreenShell({
  accent = "#F7931A",
  backgroundCss = "",
  backgroundImage,
  headerTitle,
  headerSubtitle,
  headerRight,
  headerAlign = "left",
  headerRowAlign = "end",
  children,
}) {
  const alignClass =
    headerAlign === "left"
      ? "pageHeaderAlignLeft"
      : headerAlign === "right"
        ? "pageHeaderAlignRight"
        : "pageHeaderAlignCenter";

  const rowAlignClass = headerRowAlign === "start" ? "pageHeaderRowStart" : "pageHeaderRowEnd";

  const normalizeHeaderNode = (v) => {
    if (v === null || v === undefined || v === false) return null;
    // React nodes
    if (React.isValidElement(v)) return v;
    // Primitive
    if (typeof v === "string") return v.trim() ? v : null;
    if (typeof v === "number") return String(v);

    // Common patterns: sometimes pages pass an object like { title: "..." }
    if (typeof v === "object") {
      const candidate = v.title ?? v.label ?? v.name;
      if (typeof candidate === "string") return candidate.trim() ? candidate : null;
      if (typeof candidate === "number") return String(candidate);
    }

    // Do not stringify unknown objects/functions (prevents "[object Object]")
    return null;
  };

  const titleNode = normalizeHeaderNode(headerTitle);
  const subtitleNode = normalizeHeaderNode(headerSubtitle);

  const showHeader = Boolean(titleNode || subtitleNode || headerRight);

  return (
    <AccentContext.Provider value={{ accent }}>
      <div className="screenShell" style={{ "--accent": accent }}>
        {/* Background preset (gradient) */}
        <div className="bg" style={backgroundCss ? { backgroundImage: backgroundCss } : undefined} />

        {/* Optional image overlay */}
        {backgroundImage ? <div className="bgImg" style={{ backgroundImage: `url(${backgroundImage})` }} /> : null}

        <div className="container">
          {showHeader ? (
            <div className={`pageHeader ${rowAlignClass}`}>
              <div className={`pageHeaderLeft ${alignClass}`}>
                {titleNode ? <div className="pageTitle">{titleNode}</div> : null}
                {subtitleNode ? <div className="pageSubtitle">{subtitleNode}</div> : null}
              </div>
              {headerRight ? <div className="pageHeaderRight">{headerRight}</div> : null}
            </div>
          ) : null}

          <div className="pageContent">{children}</div>
        </div>
      </div>
    </AccentContext.Provider>
  );
}
