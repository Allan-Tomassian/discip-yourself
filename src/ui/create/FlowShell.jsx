import React from "react";
import "./createFlowShell.css";

export default function FlowShell({ children, className = "" }) {
  return <div className={`flowShell${className ? ` ${className}` : ""}`}>{children}</div>;
}
