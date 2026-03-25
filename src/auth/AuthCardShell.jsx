import React from "react";
import { Card } from "../components/UI";

export default function AuthCardShell({
  title,
  subtitle,
  children,
  footer = null,
  "data-testid": dataTestId,
}) {
  return (
    <div
      data-testid={dataTestId}
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <Card style={{ width: "100%", maxWidth: 440, padding: 20 }}>
        <h1 style={{ margin: "0 0 12px" }}>{title}</h1>
        {subtitle ? <p style={{ margin: "0 0 16px", opacity: 0.8 }}>{subtitle}</p> : null}
        {children}
        {footer ? <div style={{ marginTop: 16 }}>{footer}</div> : null}
      </Card>
    </div>
  );
}

