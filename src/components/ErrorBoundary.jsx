import React from "react";
import { AppCard, EmptyState, GhostButton, PrimaryButton } from "../shared/ui/app";
import "./errorBoundary.css";

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
      <div className="errorBoundaryShell">
        <div className="errorBoundaryInner">
          <AppCard variant="elevated" className="errorBoundaryCard">
            <EmptyState
              title="Une erreur est survenue"
              subtitle="L’application a rencontré un problème inattendu. Tu peux recharger ou copier le diagnostic."
              actions={
                <div className="errorBoundaryActions">
                  <PrimaryButton onClick={() => window.location.reload()}>Recharger</PrimaryButton>
                  <GhostButton onClick={() => copyText(diagnosticText)}>
                    Copier le diagnostic
                  </GhostButton>
                </div>
              }
            />
            <details className="errorBoundaryDetails">
              <summary className="errorBoundarySummary">
                Détails
              </summary>
              <pre className="errorBoundaryDiagnostic">
                {diagnosticText}
              </pre>
            </details>
          </AppCard>
        </div>
      </div>
    );
  }
}
