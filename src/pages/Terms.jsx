import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";

export default function Terms({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      headerTitle="Conditions"
      headerSubtitle="Conditions d’utilisation"
      backgroundImage={backgroundImage}
    >
      <div className="liquidPageStack">
        <LiquidGlassSurface variant="card" density="medium">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Utilisation</div>
              <div className="liquidSurfaceSubtitle">Version simplifiée (placeholder)</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">L’application fournit des outils de planification et de suivi personnel.</div>
            <div className="small">L’utilisateur reste responsable de l’usage et des décisions prises.</div>
          </div>
        </LiquidGlassSurface>

        <LiquidGlassSurface variant="card" density="solid">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Support</div>
              <div className="liquidSurfaceSubtitle">Besoin d’aide juridique ou produit ?</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <Button variant="ghost" onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}>
              Ouvrir le support
            </Button>
          </div>
        </LiquidGlassSurface>
      </div>
    </ScreenShell>
  );
}
