import React from "react";
import ScreenShell from "./_ScreenShell";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";
import pkg from "../../package.json";

export default function Support({ data }) {
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
      <div className="liquidPageStack">
        <LiquidGlassSurface variant="card" density="solid">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Contact</div>
              <div className="liquidSurfaceSubtitle">Réponse par email</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">support@discip-yourself.app</div>
          </div>
        </LiquidGlassSurface>

        <LiquidGlassSurface variant="card" density="medium">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">FAQ</div>
              <div className="liquidSurfaceSubtitle">Placeholder</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">Q: Comment restaurer mon achat ?</div>
            <div className="small2">R: Ouvre Abonnement puis clique sur “Restaurer”.</div>
            <div className="small" style={{ marginTop: 10 }}>Q: Comment sauvegarder mes données ?</div>
            <div className="small2">R: Ouvre Données puis exporte en JSON.</div>
          </div>
        </LiquidGlassSurface>

        <LiquidGlassSurface variant="card" density="light">
          <div className="liquidSurfaceHeader">
            <div className="liquidSurfaceHeaderText">
              <div className="liquidSurfaceTitle">Version</div>
              <div className="liquidSurfaceSubtitle">Build actuelle</div>
            </div>
          </div>
          <div className="liquidSurfaceBody">
            <div className="small">{version}</div>
          </div>
        </LiquidGlassSurface>
      </div>
    </ScreenShell>
  );
}
