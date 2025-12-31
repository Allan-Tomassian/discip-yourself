import React, { useEffect, useState } from "react";
import { THEME_PRESETS } from "../logic/state";
import { Button, Card, Input, Select, Badge } from "./UI";

export default function ThemePicker({ data, setData }) {
  const [pendingTheme, setPendingTheme] = useState(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");
  const [pendingAccent, setPendingAccent] = useState(data.ui.pageAccents?.home || data.ui.accentHome || "#7C3AED");

  useEffect(() => {
    setPendingTheme(data.ui.pageThemes?.home || data.ui.pageThemeHome || "aurora");
    setPendingAccent(data.ui.pageAccents?.home || data.ui.accentHome || "#7C3AED");
  }, [data.ui.pageThemes?.home, data.ui.pageAccents?.home, data.ui.pageThemeHome, data.ui.accentHome]);

  return (
    <Card accentBorder>
      <div className="p18">
        <div className="row">
          <div>
            <div className="titleSm">Ambiance Accueil</div>
            <div className="small">Uniquement pour la page Accueil.</div>
          </div>
          <Badge>Accueil</Badge>
        </div>

        <div className="mt14 col">
          <Select value={pendingTheme} onChange={(e) => setPendingTheme(e.target.value)}>
            {THEME_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>

          <Input value={pendingAccent} onChange={(e) => setPendingAccent(e.target.value)} placeholder="#RRGGBB" />

          <Button
            onClick={() => {
              const nextAccent = (pendingAccent || "").trim() || "#7C3AED";
              setData((prev) => ({
                ...prev,
                ui: {
                  ...prev.ui,
                  pageThemes: { ...(prev.ui?.pageThemes || {}), home: pendingTheme },
                  pageAccents: { ...(prev.ui?.pageAccents || {}), home: nextAccent },
                },
              }));
            }}
          >
            Appliquer à l’accueil
          </Button>
        </div>
      </div>
    </Card>
  );
}
