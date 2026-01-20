import React, { useEffect, useState } from "react";
import { THEME_PRESETS } from "../logic/state";
import { Button, Card, SelectMenu } from "./UI";

export default function ThemePicker({ data, setData }) {
  const [pendingTheme, setPendingTheme] = useState(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingTheme(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");
  }, [data.ui.pageThemes?.home, data.ui.pageThemeHome]);

  return (
    <Card accentBorder>
      <div className="p18">
        <div className="row">
          <div>
            <div className="sectionTitle">Apparence</div>
            <div className="sectionSub">Thème global de l’app.</div>
          </div>
        </div>

        <div className="mt14 col">
          <SelectMenu
            value={pendingTheme}
            onChange={(next) => setPendingTheme(next)}
            options={THEME_PRESETS.map((p) => ({ value: p, label: p }))}
          />

          <Button
            onClick={() => {
              setData((prev) => ({
                ...prev,
                ui: {
                  ...prev.ui,
                  pageThemes: { ...(prev.ui?.pageThemes || {}), home: pendingTheme },
                },
              }));
            }}
          >
            Appliquer
          </Button>
        </div>
      </div>
    </Card>
  );
}
