import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Select } from "../components/UI";
import { getAccentForPage } from "../utils/_theme";

function resolveGoalType(goal) {
  const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
  if (legacy === "OUTCOME") return "OUTCOME";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "PROCESS";
}

export default function CategoryView({ data, setData, categoryId, onBack, onOpenPlan, onOpenCreate }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const category = categories.find((c) => c.id === categoryId) || null;
  const [showWhy, setShowWhy] = useState(true);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [goals, category?.id]);

  useEffect(() => {
    if (!category?.id) {
      setSelectedOutcomeId(null);
      return;
    }
    const mainId = category.mainGoalId && outcomeGoals.some((g) => g.id === category.mainGoalId)
      ? category.mainGoalId
      : null;
    const fallback = outcomeGoals[0]?.id || null;
    setSelectedOutcomeId((prev) => {
      if (prev && outcomeGoals.some((g) => g.id === prev)) return prev;
      return mainId || fallback;
    });
  }, [category?.id, category?.mainGoalId, outcomeGoals]);

  const selectedOutcome = useMemo(() => {
    if (!selectedOutcomeId) return null;
    return outcomeGoals.find((g) => g.id === selectedOutcomeId) || null;
  }, [outcomeGoals, selectedOutcomeId]);

  const processGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [goals, category?.id]);

  const linkedHabits = selectedOutcome ? processGoals.filter((g) => g.parentId === selectedOutcome.id) : [];
  const habits = linkedHabits.length ? linkedHabits : processGoals;

  function openPlan(categoryIdValue, openGoalEditId) {
    if (!categoryIdValue || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: { ...(prev.ui || {}), selectedCategoryId: categoryIdValue, openGoalEditId },
    }));
    if (typeof onOpenPlan === "function") onOpenPlan();
  }

  if (!categories.length) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Aucune catégorie</div>
            <div className="small" style={{ marginTop: 6 }}>
              Ajoute une première catégorie pour commencer.
            </div>
            <div className="mt12">
              <Button variant="ghost" onClick={onBack}>
                ← Bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (!category) {
    return (
      <ScreenShell
        data={safeData}
        pageId="categories"
        headerTitle="Bibliothèque"
        headerSubtitle="Catégorie introuvable"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <Card accentBorder>
          <div className="p18">
            <div className="titleSm">Catégorie introuvable</div>
            <div className="small" style={{ marginTop: 6 }}>
              Cette catégorie n’existe plus.
            </div>
            <div className="mt12">
              <Button variant="ghost" onClick={onBack}>
                ← Bibliothèque
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  const accent = getAccentForPage(safeData, "home");
  const backgroundImage = category.wallpaper || safeData.profile?.whyImage || "";
  const whyText = (category.whyText || "").trim();
  const whyDisplay = whyText || "Aucun mini-why pour cette catégorie.";

  return (
    <ScreenShell
      accent={accent}
      backgroundImage={backgroundImage}
      headerTitle="Bibliothèque"
      headerSubtitle={category.name || "Catégorie"}
    >
      <div style={{ "--catColor": category.color || "#7C3AED" }}>
        <Button variant="ghost" onClick={onBack}>
          ← Bibliothèque
        </Button>

        <Card accentBorder style={{ marginTop: 12, borderColor: category.color || undefined }}>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Mini-why</div>
                <div className="small2">Visible pour cette catégorie</div>
              </div>
              <button className="linkBtn" onClick={() => setShowWhy((v) => !v)}>
                {showWhy ? "Masquer" : "Afficher"}
              </button>
            </div>
            {showWhy ? <div className="mt12 small2">{whyDisplay}</div> : null}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12, borderColor: category.color || undefined }}>
          <div className="p18">
            <div className="titleSm">Objectif</div>
            {outcomeGoals.length ? (
              <div className="mt12 col">
                {outcomeGoals.length > 1 ? (
                  <Select value={selectedOutcomeId || ""} onChange={(e) => setSelectedOutcomeId(e.target.value)}>
                    {outcomeGoals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title || "Objectif"}
                      </option>
                    ))}
                  </Select>
                ) : null}
                <div className="small2" style={{ marginTop: outcomeGoals.length > 1 ? 8 : 0 }}>
                  {selectedOutcome?.title || outcomeGoals[0]?.title || "Objectif"}
                </div>
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucun objectif dans cette catégorie.</div>
                <div className="mt10">
                  <Button variant="ghost" onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}>
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card accentBorder style={{ marginTop: 12 }}>
          <div className="p18">
            <div className="titleSm">Habitudes</div>
            {habits.length ? (
              <div className="mt12 col">
                {habits.map((h) => (
                  <div key={h.id} className="listItem">
                    <div style={{ fontWeight: 700 }}>{h.title || "Habitude"}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt12 col">
                <div className="small2">Aucune habitude liée.</div>
                <div className="mt10">
                  <Button variant="ghost" onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}>
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
