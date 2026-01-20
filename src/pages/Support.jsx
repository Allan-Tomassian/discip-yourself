import React from "react";
import ScreenShell from "./_ScreenShell";
import { Card } from "../components/UI";
import pkg from "../../package.json";

export default function Support({ data, onBack }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const version = pkg?.version || "0.0.0";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      headerTitle="Support"
      headerSubtitle="Aide & contact"
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <div className="titleSm">Contact</div>
            <div className="small">support@discip-yourself.app</div>
            <div className="titleSm">FAQ</div>
            <div className="small">
              Besoin d’aide sur le planning, les sessions ou les rappels ? Écris-nous avec une description précise.
            </div>
            <div className="titleSm">Version</div>
            <div className="small">{version}</div>
          </div>
        </Card>
        {typeof onBack === "function" ? (
          <button className="btnBackCompact backBtn" onClick={onBack}>
            ← Retour
          </button>
        ) : null}
      </div>
    </ScreenShell>
  );
}
