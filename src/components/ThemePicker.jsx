import React, { useEffect, useMemo, useState } from "react";
import { applyThemeTokens, BRAND_ACCENT, getThemeName, listThemes } from "../theme/themeTokens";
import { Button, Card, SelectMenu } from "./UI";

function toLabel(name) {
  if (!name) return "";
  const s = String(name).trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function preserveAccentWhile(applyFn) {
  if (typeof document === "undefined") return applyFn();
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const keys = [
    "--accent",
    "--accentStrong",
    "--accentPrimary",
    "--focus",
    "--ring",
    "--accentText",
  ];
  const snapshot = {};
  for (const k of keys) snapshot[k] = cs.getPropertyValue(k);
  applyFn();
  // Restore accent variables so theme preview cannot take over the app accent.
  for (const k of keys) {
    const v = snapshot[k];
    if (v != null && String(v).trim() !== "") root.style.setProperty(k, v);
  }
}

export default function ThemePicker({ data, setData }) {
  // Single source of truth: `data.ui.theme` (global). Keep backward compat with per-page themes.
  const persistedGlobalTheme = data?.ui?.theme;
  const savedTheme = persistedGlobalTheme || getThemeName(data, "home");

  // Accent is locked to brand globally.
  const savedAccent = BRAND_ACCENT;

  const themeOptions = useMemo(() => {
    // Prefer the canonical theme list. If empty for any reason, fall back to aurora.
    const themes = listThemes();
    const safe = Array.isArray(themes) && themes.length ? themes : ["aurora"];
    return safe.map((p) => ({ value: p, label: toLabel(p) }));
  }, []);

  const [pendingTheme, setPendingTheme] = useState(() => savedTheme || "aurora");

  // Keep local selection in sync if the persisted theme changes elsewhere.
  useEffect(() => {
    setPendingTheme(savedTheme || "aurora");
  }, [savedTheme]);

  // Premium behavior: live preview the selected theme while still allowing an explicit “Appliquer”.
  // Revert automatically when the component unmounts (or when selection changes away).
  useEffect(() => {
    preserveAccentWhile(() => applyThemeTokens(pendingTheme, savedAccent));
    return () => {
      preserveAccentWhile(() => applyThemeTokens(savedTheme || "aurora", savedAccent));
    };
  }, [pendingTheme, savedTheme, savedAccent]);

  const isDirty = pendingTheme !== (savedTheme || "aurora");

  return (
    <Card accentBorder>
      <div className="p18">
        <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sectionTitle">Apparence</div>
            <div className="sectionSub">Choisis un style. Aperçu instantané, puis valide.</div>
          </div>
        </div>

        <div className="mt14 col" style={{ gap: 12 }}>
          <SelectMenu value={pendingTheme} onChange={setPendingTheme} options={themeOptions} />

          <div className="row" style={{ gap: 10, justifyContent: "space-between" }}>
            <div className="hint" style={{ margin: 0 }}>
              Thème actuel : <span style={{ color: "var(--text)" }}>{toLabel(savedTheme || "aurora")}</span>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <Button
                className="btnSecondary"
                disabled={!isDirty}
                onClick={() => setPendingTheme(savedTheme || "aurora")}
              >
                Réinitialiser
              </Button>

              <Button
                disabled={!isDirty}
                onClick={() => {
                  setData((prev) => {
                    const nextUi = {
                      ...(prev.ui || {}),
                      // Global theme (single truth)
                      theme: pendingTheme,
                      // Backward compatibility: keep home + a default slot for pages that still read pageThemes
                      pageThemes: {
                        ...(prev.ui?.pageThemes || {}),
                        home: pendingTheme,
                        __default: pendingTheme,
                      },
                    };
                    return { ...prev, ui: nextUi };
                  });
                }}
              >
                Appliquer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
