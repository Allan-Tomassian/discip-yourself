import React, { useEffect, useState } from "react";
import { THEME_PRESETS } from "../logic/state";
import { Button, Card, Select } from "./UI";

export default function ThemePicker({ data, setData }) {
  const [pendingTheme, setPendingTheme] = useState(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");

  useEffect(() => {
    setPendingTheme(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");
  }, [data.ui.pageThemes?.home, data.ui.pageThemeHome]);

  return (
    <Card accentBorder>
      <div className="p18">
        <div className="row">
          <div>
            <div className="sectionTitle textAccent">Apparence</div>
            <div className="sectionSub">Thème global de l’app.</div>
          </div>
        </div>

        <div className="mt14 col">
          <Select value={pendingTheme} onChange={(e) => setPendingTheme(e.target.value)}>
            {THEME_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>

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
