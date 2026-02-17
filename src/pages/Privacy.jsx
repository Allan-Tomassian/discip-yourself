import React from "react";
import ScreenShell from "./_ScreenShell";
import { Button } from "../components/UI";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";

export default function Privacy({ data, onOpenSupport }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";

  return (
    <ScreenShell
      data={safeData}
      pageId="legal"
      headerTitle="Confidentialité"
      headerSubtitle="Politique de confidentialité"
      backgroundImage={backgroundImage}
    >
      <div className="liquidPageStack">
        <LiquidGlassSurface variant="card" density="medium">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Données collectées</div>
              <div className="liquidSurfaceSubtitle">Version simplifiée (placeholder)</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">Les données de planification et préférences sont utilisées pour faire fonctionner l’app.</div>
            <div className="small">Stockage principal côté utilisateur authentifié (Supabase + cache local).</div>
          </div>
        </LiquidGlassSurface>

        <LiquidGlassSurface variant="card" density="solid">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Contact</div>
              <div className="liquidSurfaceSubtitle">Questions RGPD / données</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">support@discip-yourself.app</div>
            <Button variant="ghost" onClick={() => (typeof onOpenSupport === "function" ? onOpenSupport() : null)}>
              Contacter le support
            </Button>
          </div>
        </LiquidGlassSurface>
      </div>
    </ScreenShell>
  );
}
