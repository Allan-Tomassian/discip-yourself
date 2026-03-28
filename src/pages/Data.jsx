import React, { useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection } from "../shared/ui/gate/Gate";
import GatePage from "../shared/ui/gate/GatePage";
import { isPremium } from "../logic/entitlements";
import { STATUS_COPY } from "../ui/labels";

function downloadJsonFile(filename, payload) {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch {
    // no-op
  }
}

export default function Data({ data, setData, onOpenPaywall }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const premium = isPremium(safeData);
  const importInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState("");

  function handleImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          setImportStatus(STATUS_COPY.importInvalid);
          return;
        }
        setData(() => parsed);
        setImportStatus(STATUS_COPY.importDone);
      } catch {
        setImportStatus(STATUS_COPY.importInvalid);
      }
    };
    reader.onerror = () => {
      setImportStatus(STATUS_COPY.importReadError);
    };
    reader.readAsText(file);
  }

  return (
    <ScreenShell data={safeData} pageId="settings" backgroundImage={backgroundImage}>
      <GatePage
        title={<span className="GatePageTitle">Données</span>}
        subtitle={<span className="GatePageSubtitle">Exporter ou réimporter l’état complet de l’app.</span>}
      >
        <GateSection
          title="Sauvegarde"
          description="Exporte ou importe l’état complet de l’app."
          collapsible={false}
          className="GateSurfacePremium GateCardPremium GateSecondarySectionCard"
        >
          <div className="GatePrimaryCtaRow">
            <GateButton
              className="GatePressable"
              onClick={() => {
                if (!premium) {
                  if (typeof onOpenPaywall === "function") onOpenPaywall("Export des données");
                  return;
                }
                downloadJsonFile("discip-yourself-data.json", safeData);
              }}
            >
              Exporter mes données (JSON)
            </GateButton>

            <input
              ref={importInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
                handleImportFile(file);
                event.target.value = "";
              }}
            />

            <GateButton
              variant="ghost"
              className="GatePressable"
              onClick={() => {
                importInputRef.current?.click();
              }}
            >
              Importer un fichier JSON
            </GateButton>
          </div>

          {importStatus ? (
            <div className="GateInlineMetaCard gatePageInlineText">
              <div className="GateRoleHelperText">{importStatus}</div>
            </div>
          ) : null}
        </GateSection>
      </GatePage>
    </ScreenShell>
  );
}
