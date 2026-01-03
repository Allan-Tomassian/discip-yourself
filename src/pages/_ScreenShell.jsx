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
  return (
    <AccentContext.Provider value={{ accent }}>
      {/* Background preset (gradient) */}
      <div className="bg" style={backgroundCss ? { backgroundImage: backgroundCss } : undefined} />

      {/* Optional image overlay */}
      {backgroundImage ? <div className="bgImg" style={{ backgroundImage: `url(${backgroundImage})` }} /> : null}

      <div className="container">
        {headerRight ? (
          <div
            className="hdrRow"
            style={{ display: "flex", justifyContent: "space-between", alignItems: headerAlign, gap: 12 }}
          >
            <div>
              <div className="hdrTitle">{headerTitle}</div>
              <div className="hdrSub" style={{ marginTop: 4 }}>
                {headerSubtitle}
              </div>
            </div>
            <div>{headerRight}</div>
          </div>
        ) : (
          <>
            <div className="hdrTitle">{headerTitle}</div>
            <div className="hdrSub" style={{ marginTop: 4 }}>
              {headerSubtitle}
            </div>
          </>
        )}
        <div className="mt16">{children}</div>
      </div>
    </AccentContext.Provider>
  );
}
