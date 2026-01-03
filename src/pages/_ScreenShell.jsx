import React from "react";
import { AccentContext } from "../components/UI";

export default function ScreenShell({
  accent = "#FFFFFF",
  backgroundCss = "",
  backgroundImage,
  headerTitle,
  headerSubtitle,
  headerRight,
  headerAlign = "center",
  children,
}) {
  const textAlign = headerAlign === "left" ? "left" : headerAlign === "right" ? "right" : "center";

  return (
    <AccentContext.Provider value={{ accent }}>
      {/* Background preset (gradient) */}
      <div className="bg" style={backgroundCss ? { backgroundImage: backgroundCss } : undefined} />

      {/* Optional image overlay */}
      {backgroundImage ? <div className="bgImg" style={{ backgroundImage: `url(${backgroundImage})` }} /> : null}

      <div className="container">
        <div className="pageHeader">
          {headerRight ? (
            <div className="hdrRow">
              <div className="hdrLeft" style={{ textAlign }}>
                <div className="hdrTitle pageTitle">{headerTitle}</div>
                <div className="hdrSub pageSubtitle">{headerSubtitle}</div>
              </div>
              <div className="hdrRight">{headerRight}</div>
            </div>
          ) : (
            <div className="hdrLeft" style={{ textAlign }}>
              <div className="hdrTitle pageTitle">{headerTitle}</div>
              <div className="hdrSub pageSubtitle">{headerSubtitle}</div>
            </div>
          )}
        </div>
        <div className="pageContent">{children}</div>
      </div>
    </AccentContext.Provider>
  );
}
