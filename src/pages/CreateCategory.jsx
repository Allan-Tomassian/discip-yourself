import React, { useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input, Textarea } from "../components/UI";
import { uid } from "../utils/helpers";
import { setPrimaryCategory } from "../logic/priority";

// TOUR MAP:
// - primary_action: create category
// - key_elements: name input, color picker, priority toggle, submit/cancel
// - optional_elements: mini-why textarea
export default function CreateCategory({ data, setData, onCancel, onDone }) {
  const safeData = data && typeof data === "object" ? data : {};
  const backgroundImage = safeData?.profile?.whyImage || "";
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7C3AED");
  const [whyText, setWhyText] = useState("");
  const [isPriority, setIsPriority] = useState(false);

  const canSubmit = Boolean(name.trim());
  const safeColor = /^#([0-9A-Fa-f]{6})$/.test(color || "") ? color : "#7C3AED";

  function handleCreate() {
    if (!canSubmit || typeof setData !== "function") return;
    const cleanName = name.trim();
    const cleanColor = /^#([0-9A-Fa-f]{6})$/.test(color || "") ? color : "#7C3AED";
    const cleanWhy = (whyText || "").trim();
    const id = uid();

    setData((prev) => {
      const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
      const nextCategories = [
        ...prevCategories,
        {
          id,
          name: cleanName,
          color: cleanColor,
          wallpaper: "",
          whyText: cleanWhy,
          mainGoalId: null,
          priorityLevel: isPriority ? "primary" : "normal",
        },
      ];

      const prevUi = prev.ui || {};
      const prevOrder = Array.isArray(prevUi.categoryRailOrder) ? prevUi.categoryRailOrder : [];
      const nextOrder = prevOrder.includes(id) ? prevOrder : [...prevOrder, id];
      const isFirst = prevCategories.length === 0;
      const prevSel =
        prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
          ? prevUi.selectedCategoryByView
          : {};
      const nextSelectedByView = { ...prevSel, home: id, library: id };
      const nextUi = isFirst
        ? {
            ...prevUi,
            selectedCategoryId: id,
            librarySelectedCategoryId: id,
            selectedCategoryByView: nextSelectedByView,
            categoryRailOrder: nextOrder,
          }
        : {
            ...prevUi,
            librarySelectedCategoryId: id,
            selectedCategoryByView: nextSelectedByView,
            categoryRailOrder: nextOrder,
          };

      let next = { ...prev, categories: nextCategories, ui: nextUi };
      if (isPriority) next = setPrimaryCategory(next, id);
      return next;
    });

    if (typeof onDone === "function") onDone({ categoryId: id });
  }

  return (
    <ScreenShell
      data={safeData}
      pageId="categories"
      headerTitle={<span data-tour-id="create-category-title">Créer</span>}
      headerSubtitle={
        <>
          <span style={{ opacity: 0.6 }}>1.</span> Catégorie
        </>
      }
      backgroundImage={backgroundImage}
    >
      <div className="stack stackGap12">
        <Button
          variant="ghost"
          className="btnBackCompact backBtn"
          onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
          data-tour-id="create-category-back"
        >
          ← Retour
        </Button>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 10 }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la catégorie"
              data-tour-id="create-category-name"
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
              data-tour-id="create-category-color"
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
              data-tour-id="create-category-why"
            />
            <label className="includeToggle" data-tour-id="create-category-priority">
              <input type="checkbox" checked={isPriority} onChange={(e) => setIsPriority(e.target.checked)} />
              <span>Prioritaire</span>
            </label>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={() => (typeof onCancel === "function" ? onCancel() : null)}
                data-tour-id="create-category-cancel"
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit} data-tour-id="create-category-submit">
                Créer
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
