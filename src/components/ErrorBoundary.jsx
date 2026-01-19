import React from "react";
import { Button, Card } from "./UI";

function buildDiagnosticText(error, info) {
  const message = error?.message || (error ? String(error) : "Erreur inconnue");
  const stack = error?.stack || "";
  const componentStack = info?.componentStack || "";
  return [
    "Message:",
    message,
    "",
    "Stack:",
    stack || "—",
    "",
    "Component stack:",
    componentStack || "—",
  ].join("\n");
}

async function copyText(text) {
  if (!text) return;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      void err;
      // fallback below
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "true");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.left = "-1000px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  } catch (err) {
    void err;
    // no-op
  }
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const diagnosticText = buildDiagnosticText(this.state.error, this.state.info);
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background:
            "linear-gradient(160deg, rgba(250,249,247,0.96) 0%, rgba(236,232,225,0.96) 100%)",
        }}
      >
        <Card accentBorder style={{ maxWidth: 680, width: "100%" }}>
          <div className="p18">
            <div className="titleSm">Une erreur est survenue</div>
            <div className="small" style={{ marginTop: 8 }}>
              L’application a rencontré un problème inattendu. Vous pouvez recharger ou copier le diagnostic.
            </div>
            <div className="row" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
              <Button onClick={() => window.location.reload()}>Recharger</Button>
              <Button variant="ghost" onClick={() => copyText(diagnosticText)}>
                Copier le diagnostic
              </Button>
            </div>
            <details style={{ marginTop: 16 }}>
              <summary className="small" style={{ cursor: "pointer" }}>
                Détails
              </summary>
              <pre
                className="small2"
                style={{
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 260,
                  overflow: "auto",
                  background: "rgba(0,0,0,0.04)",
                  padding: 12,
                  borderRadius: 10,
                }}
              >
                {diagnosticText}
              </pre>
            </details>
          </div>
        </Card>
      </div>
    );
  }
}
