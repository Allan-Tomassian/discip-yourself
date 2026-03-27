import React from "react";
import { GateButton, GateHeader, GatePanel } from "../shared/ui/gate/Gate";
import "../shared/ui/gate/gate-standalone.css";

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
      <div className="gateStandaloneShell">
        <div className="gateStandaloneInner" style={{ width: "min(100%, 680px)" }}>
          <GatePanel className="gateStandalonePanel GateMainSection GateSurfacePremium GateCardPremium">
            <GateHeader
              className="gateStandaloneHeader"
              title="Une erreur est survenue"
              subtitle="L’application a rencontré un problème inattendu. Tu peux recharger ou copier le diagnostic."
            />
            <div className="gateStandaloneContent">
              <div className="row" style={{ marginTop: 6, gap: 8, flexWrap: "wrap" }}>
              <GateButton onClick={() => window.location.reload()}>Recharger</GateButton>
              <GateButton variant="secondary" onClick={() => copyText(diagnosticText)}>
                Copier le diagnostic
              </GateButton>
              </div>
              <details style={{ marginTop: 10 }}>
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
                    background: "color-mix(in srgb, var(--surface-elevated) 88%, rgba(255,255,255,0.04))",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--hairline)",
                  }}
                >
                  {diagnosticText}
                </pre>
              </details>
            </div>
          </GatePanel>
        </div>
      </div>
    );
  }
}
