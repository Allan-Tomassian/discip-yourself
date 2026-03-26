import React from "react";
import { GatePanel } from "../../shared/ui/gate/Gate";
import "../../features/create-flow/createFlow.css";

export default function FlowShell({ children, className = "" }) {
  return (
    <GatePanel className={`flowShell flowShellPanel createFlowScope${className ? ` ${className}` : ""}`}>
      {children}
    </GatePanel>
  );
}
