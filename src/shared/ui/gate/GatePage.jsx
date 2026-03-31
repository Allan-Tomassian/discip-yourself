import React from "react";
import "./gatePage.css";

export default function GatePage({ title, subtitle, actions = null, className = "", children }) {
  void title;
  void subtitle;
  void actions;
  return (
    <div className={`gatePageRoot${className ? ` ${className}` : ""}`}>
      <div className="gatePageContent">{children}</div>
    </div>
  );
}
