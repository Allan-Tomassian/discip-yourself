import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Select, Textarea } from "../components/UI";
import { normalizeCreationDraft } from "../creation/creationDraft";
import { STEP_OUTCOME } from "../creation/creationSchema";

export default function CreateV2Category({
  data,
  setData,
  onBack,
  onNext,
  onCancel,
  canCreateCategory = true,
  onOpenPaywall,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const draft = useMemo(() => normalizeCreationDraft(safeData?.ui?.createDraft), [safeData?.ui?.createDraft]);
  const initialMode = draft.category?.mode || (categories.length ? "existing" : "new");

  const [mode, setMode] = useState(initialMode);
  const [selectedId, setSelectedId] = useState(draft.category?.id || categories[0]?.id || "");
  const [name, setName] = useState(draft.category?.name || "");
  const [color, setColor] = useState(draft.category?.color || "#7C3AED");
  const [whyText, setWhyText] = useState(draft.category?.whyText || "");
  const [isPriority, setIsPriority] = useState(draft.category?.priorityLevel === "primary");

  const canSubmit =
    mode === "existing" ? Boolean(selectedId) : Boolean((name || "").trim());
  const safeColor = /^#([0-9A-Fa-f]{6})$/.test(color || "") ? color : "#7C3AED";

  function updateDraft(nextCategory) {
    if (typeof setData !== "function") return;
    setData((prev) => {
      const prevUi = prev.ui || {};
      return {
        ...prev,
        ui: {
          ...prevUi,
          createDraft: {
            ...normalizeCreationDraft(prevUi.createDraft),
            category: nextCategory,
            step: STEP_OUTCOME,
          },
        },
      };
    });
  }

  function handleNext() {
    if (!canSubmit) return;
    if (mode === "new" && !canCreateCategory) {
      if (typeof onOpenPaywall === "function") onOpenPaywall("Limite de catégories atteinte.");
      return;
    }
    if (mode === "existing") {
      updateDraft({ mode, id: selectedId });
    } else {
      updateDraft({
        mode,
        name: name.trim(),
        color: safeColor,
        whyText: (whyText || "").trim(),
        priorityLevel: isPriority ? "primary" : "normal",
      });
    }
    if (typeof onNext === "function") onNext();
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle="Créer"
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>1.</span> Catégorie
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button variant="ghost" className="btnBackCompact backBtn" onClick={onBack}>
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 12 }}>
            {categories.length ? (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Button variant={mode === "existing" ? "primary" : "ghost"} onClick={() => setMode("existing")}
                >
                  Catégorie existante
                </Button>
                <Button variant={mode === "new" ? "primary" : "ghost"} onClick={() => setMode("new")}
                >
                  Nouvelle catégorie
                </Button>
              </div>
            ) : null}

            {mode === "existing" && categories.length ? (
              <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="" disabled>
                  Sélectionner une catégorie
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || "Catégorie"}
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nom de la catégorie"
                />
                <div
                  className="row"
                  style={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    background: "#0C0C0C",
                    border: "1px solid rgba(255,255,255,.16)",
                    borderRadius: 12,
                    padding: 10,
                    position: "relative",
                  }}
                >
                  <div className="row" style={{ alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: safeColor,
                        border: "1px solid rgba(255,255,255,.18)",
                      }}
                    />
                    <div className="small2">Couleur</div>
                  </div>
                  <div style={{ position: "relative", display: "inline-flex" }}>
                    <Button variant="ghost" type="button">
                      Choisir
                    </Button>
                    <input
                      type="color"
                      value={safeColor}
                      onChange={(e) => setColor(e.target.value)}
                      style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                      aria-label="Choisir une couleur"
                    />
                  </div>
                </div>
                <Textarea
                  value={whyText}
                  onChange={(e) => setWhyText(e.target.value)}
                  placeholder="Mini-why (optionnel)"
                />
                <label className="includeToggle">
                  <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} />
                  <span>Prioritaire</span>
                </label>
              </>
            )}
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => {
                  if (typeof onCancel === "function") {
                    onCancel();
                    return;
                  }
                  if (typeof onBack === "function") onBack();
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleNext} disabled={!canSubmit}>
                Continuer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
