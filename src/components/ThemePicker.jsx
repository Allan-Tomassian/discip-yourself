import React, { useEffect, useMemo, useState } from "react";
import { applyThemeTokens, BRAND_ACCENT, getThemeName, listThemes } from "../theme/themeTokens";
import { Button, SelectMenu } from "./UI";
import LiquidGlassSurface from "../ui/LiquidGlassSurface";

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
  for (const k of keys) {
    const v = snapshot[k];
    if (v != null && String(v).trim() !== "") root.style.setProperty(k, v);
  }
}

export default function ThemePicker({ data, setData }) {
  const persistedGlobalTheme = data?.ui?.theme;
  const savedTheme = persistedGlobalTheme || getThemeName(data, "home");
  const savedAccent = BRAND_ACCENT;

  const themeOptions = useMemo(() => {
    const themes = listThemes();
    const safe = Array.isArray(themes) && themes.length ? themes : ["aurora"];
    return safe.map((p) => ({ value: p, label: toLabel(p) }));
  }, []);

  const [pendingTheme, setPendingTheme] = useState(() => savedTheme || "aurora");

  useEffect(() => {
    setPendingTheme(savedTheme || "aurora");
  }, [savedTheme]);

  useEffect(() => {
    preserveAccentWhile(() => applyThemeTokens(pendingTheme, savedAccent));
    return () => {
      preserveAccentWhile(() => applyThemeTokens(savedTheme || "aurora", savedAccent));
    };
  }, [pendingTheme, savedTheme, savedAccent]);

  const isDirty = pendingTheme !== (savedTheme || "aurora");

  return (
    <LiquidGlassSurface variant="card" density="solid">
      <div className="liquidSurfaceHeader">
        <div className="liquidSurfaceHeaderText">
          <div className="liquidSurfaceTitle">Apparence</div>
          <div className="liquidSurfaceSubtitle">Choisis un style. Aperçu instantané, puis valide.</div>
        </div>
      </div>

      <div className="liquidSurfaceBody">
        <SelectMenu value={pendingTheme} onChange={setPendingTheme} options={themeOptions} />

        <div className="liquidActionsRow" style={{ justifyContent: "space-between" }}>
          <div className="liquidNote" style={{ margin: 0 }}>
            Thème actuel : <span style={{ color: "var(--text)" }}>{toLabel(savedTheme || "aurora")}</span>
          </div>

          <div className="liquidActionsRow">
            <Button className="btnSecondary" disabled={!isDirty} onClick={() => setPendingTheme(savedTheme || "aurora")}> 
              Réinitialiser
            </Button>

            <Button
              disabled={!isDirty}
              onClick={() => {
                setData((prev) => {
                  const nextUi = {
                    ...(prev.ui || {}),
                    theme: pendingTheme,
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
    </LiquidGlassSurface>
  );
}
