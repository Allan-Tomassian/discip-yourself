import { buildAiDebugLine, shouldShowAiDebugUi } from "../../infra/aiTransportDiagnostics";

const DEBUG_STYLE = Object.freeze({
  marginTop: "0.375rem",
  fontSize: "0.72rem",
  lineHeight: 1.35,
  opacity: 0.72,
  wordBreak: "break-word",
});

function buildDebugTitle(details = {}) {
  const pairs = [
    ["surface", details?.surface],
    ["status", details?.status],
    ["probableCause", details?.probableCause],
    ["baseUrlUsed", details?.baseUrlUsed],
    ["originUsed", details?.originUsed],
  ].filter(([, value]) => value !== null && value !== undefined && String(value).trim());
  return pairs.map(([key, value]) => `${key}=${value}`).join("\n");
}

export default function AiDebugLine({ diagnostics = null, className = "" }) {
  if (!shouldShowAiDebugUi()) return null;
  const text = buildAiDebugLine(diagnostics);
  if (!text) return null;

  return (
    <div
      className={className}
      data-testid="ai-debug-line"
      style={DEBUG_STYLE}
      title={buildDebugTitle(diagnostics)}
    >
      {text}
    </div>
  );
}
