import React from "react";
import { GateStandaloneScreen } from "../shared/ui/gate/GateForm";

export default function AuthCardShell({
  title,
  subtitle,
  children,
  footer = null,
  "data-testid": dataTestId,
}) {
  return (
    <GateStandaloneScreen
      data-testid={dataTestId}
      title={title}
      subtitle={subtitle}
      footer={footer}
    >
      {children}
    </GateStandaloneScreen>
  );
}
