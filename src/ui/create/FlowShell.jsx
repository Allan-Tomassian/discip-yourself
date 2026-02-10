import React from "react";
import "../../features/create-flow/createFlow.css";

export default function FlowShell({ children, className = "" }) {
  return <div className={`flowShell createFlowScope${className ? ` ${className}` : ""}`}>{children}</div>;
}
