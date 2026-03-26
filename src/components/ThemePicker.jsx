import React from "react";
import { DEFAULT_THEME } from "../theme/themeTokens";
import { GateButton, GateHeader, GatePanel } from "../shared/ui/gate/Gate";

export default function ThemePicker({ data, setData }) {
  void data;
  const visualSystemLabel = DEFAULT_THEME.charAt(0).toUpperCase() + DEFAULT_THEME.slice(1);

  return (
    <GatePanel className="GateSurfacePremium GateCardPremium">
      <GateHeader title="Apparence" subtitle="Le design system global est maintenant unique sur toute l’app." />
      <div className="row rowBetween rowWrap gap8">
        <div className="GatePageSubtitle">
          Thème actuel : <span style={{ color: "var(--text)" }}>{visualSystemLabel}</span>
        </div>
        <div className="GatePrimaryCtaRow">
          <GateButton
            variant="ghost"
            className="GatePressable"
            onClick={() => {
              if (typeof setData !== "function") return;
              setData((prev) => ({
                ...prev,
                ui: {
                  ...(prev?.ui || {}),
                  theme: DEFAULT_THEME,
                  pageThemes: {
                    ...((prev?.ui?.pageThemes && typeof prev.ui.pageThemes === "object")
                      ? prev.ui.pageThemes
                      : {}),
                    __default: DEFAULT_THEME,
                    home: DEFAULT_THEME,
                  },
                },
              }));
            }}
          >
            Confirmer le thème global
          </GateButton>
        </div>
      </div>
    </GatePanel>
  );
}
