import React, { useRef, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";
import { isPremium } from "../logic/entitlements";

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
          setImportStatus("Import impossible: JSON invalide.");
          return;
        }
        setData(() => parsed);
        setImportStatus("Import terminé.");
      } catch {
        setImportStatus("Import impossible: JSON invalide.");
      }
    };
    reader.onerror = () => {
      setImportStatus("Import impossible: lecture du fichier.");
    };
    reader.readAsText(file);
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="settings"
      headerTitle="Données"
      headerSubtitle="Export / import JSON"
      backgroundImage={backgroundImage}
    >
      <div className="liquidPageStack">
        <LiquidGlassSurface variant="card" density="solid">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Sauvegarde</div>
              <div className="liquidSurfaceSubtitle">Exporte ou importe l’état complet de l’app.</div>
            </div>
          </div>

          <div className="liquidSurfaceBody">
            <div className="liquidActionsCol">
              <Button
                onClick={() => {
                  if (!premium) {
                    if (typeof onOpenPaywall === "function") onOpenPaywall("Export des données");
                    return;
                  }
                  downloadJsonFile("discip-yourself-data.json", safeData);
                }}
              >
                Exporter mes données (JSON)
              </Button>

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

              <Button
                variant="ghost"
                onClick={() => {
                  importInputRef.current?.click();
                }}
              >
                Importer un JSON
              </Button>

              {importStatus ? <div className="liquidNote">{importStatus}</div> : null}
            </div>
          </div>
        </LiquidGlassSurface>
      </div>
    </ScreenShell>
  );
}
