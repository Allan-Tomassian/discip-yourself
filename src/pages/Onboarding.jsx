import React, { useState } from "react";
import { Button, Card, Input, Textarea, Badge } from "../components/UI";
import { uid, readFileAsDataUrl } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { createGoal } from "../logic/goals";
import ScreenShell from "./_ScreenShell";

export default function Onboarding({ data, setData, onDone }) {
  const [name, setName] = useState(data.profile.name || "");
  const [why, setWhy] = useState(data.profile.whyText || "");
  const [img, setImg] = useState(data.profile.whyImage || "");
  const [error, setError] = useState("");
  const minChars = 24;
  const [categoryName, setCategoryName] = useState("");
  const [outcomeTitle, setOutcomeTitle] = useState("");
  const [processTitle, setProcessTitle] = useState("");

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];

  function resolveGoalType(goal) {
    const raw = typeof goal?.type === "string" ? goal.type.toUpperCase() : "";
    if (raw === "OUTCOME" || raw === "PROCESS") return raw;
    if (raw === "STATE") return "OUTCOME";
    if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
    const legacy = typeof goal?.kind === "string" ? goal.kind.toUpperCase() : "";
    if (legacy === "OUTCOME") return "OUTCOME";
    if (legacy === "ACTION") return "PROCESS";
    if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
    return "PROCESS";
  }

  const outcomeGoal = goals.find((g) => resolveGoalType(g) === "OUTCOME") || null;
  const needsCategory = categories.length === 0;
  const needsOutcome = !outcomeGoal;
  const needsProcess = !goals.some(
    (g) => resolveGoalType(g) === "PROCESS" && g.parentId && g.parentId === outcomeGoal?.id
  );

  function cadenceFromUnit(unit) {
    if (unit === "DAY") return "DAILY";
    if (unit === "WEEK") return "WEEKLY";
    return "YEARLY";
  }

  return (
    <ScreenShell
      data={data}
      pageId="onboarding"
      headerTitle="Ton Pourquoi"
      headerSubtitle="Inscription (obligatoire)"
      backgroundImage={img || ""}
    >
      <Card accentBorder>
        <div className="p18">
          <div className="row">
            <div>
              <div className="titleSm">Phrase d’engagement</div>
              <div className="small">Pas de discipline sans sens. Tu dois l’écrire.</div>
            </div>
            <Badge>V2</Badge>
          </div>

          <div className="mt14 col">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ton prénom" />
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Écris ton pourquoi" />

            <div className="listItem">
              <div className="row">
                <div>
                  <div className="titleSm">Image du pourquoi (optionnelle)</div>
                  <div className="small">Une image qui te rappelle ce que tu veux vraiment.</div>
                </div>
                <Badge>{img ? "Ajoutée" : "—"}</Badge>
              </div>

              <div className="mt12" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="btn btnGhost" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Importer
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setImg(await readFileAsDataUrl(f));
                    }}
                  />
                </label>
                <Button variant="ghost" onClick={() => setImg("")}>Retirer</Button>
              </div>
            </div>

            <div className="listItem">
              <div className="row">
                <div>
                  <div className="titleSm">Base minimale</div>
                  <div className="small">1 catégorie · 1 objectif résultat · 1 action liée.</div>
                </div>
                <Badge>Requis</Badge>
              </div>

              <div className="mt12 col">
                {needsCategory ? (
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Nom de la première catégorie"
                  />
                ) : (
                  <div className="small2">Catégorie : {categories[0]?.name || "OK"}</div>
                )}

                {needsOutcome ? (
                  <Input
                    value={outcomeTitle}
                    onChange={(e) => setOutcomeTitle(e.target.value)}
                    placeholder="Objectif résultat"
                  />
                ) : (
                  <div className="small2">Objectif résultat : {outcomeGoal?.title || "OK"}</div>
                )}

                {needsProcess ? (
                  <Input
                    value={processTitle}
                    onChange={(e) => setProcessTitle(e.target.value)}
                    placeholder="Première action liée"
                  />
                ) : (
                  <div className="small2">Action liée : OK</div>
                )}
              </div>
            </div>

            {error ? <div style={{ color: "rgba(255,120,120,.95)", fontSize: 13 }}>{error}</div> : null}

            <Button
              onClick={() => {
                const cleanName = (name || "").trim();
                const cleanWhy = (why || "").trim();
                const cleanCategory = (categoryName || "").trim();
                const cleanOutcome = (outcomeTitle || "").trim();
                const cleanProcess = (processTitle || "").trim();

                if (!cleanName) {
                  setError("Prénom requis.");
                  return;
                }
                if (cleanWhy.length < minChars) {
                  setError(`Ton pourquoi doit faire au moins ${minChars} caractères.`);
                  return;
                }
                if (needsCategory && !cleanCategory) {
                  setError("Nom de catégorie requis.");
                  return;
                }
                if (needsOutcome && !cleanOutcome) {
                  setError("Objectif résultat requis.");
                  return;
                }
                if (needsProcess && !cleanProcess) {
                  setError("Action liée requise.");
                  return;
                }
                setError("");

                setData((prev) => {
                  const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
                  const prevGoals = Array.isArray(prev.goals) ? prev.goals : [];
                  const prevUi = prev.ui || {};
                  let nextCategories = prevCategories;
                  let selectedCategoryId = prevUi.selectedCategoryId || prevCategories[0]?.id || null;

                  if (needsCategory) {
                    const newCategoryId = uid();
                    nextCategories = [
                      ...prevCategories,
                      { id: newCategoryId, name: cleanCategory, color: "#7C3AED", wallpaper: "" },
                    ];
                    selectedCategoryId = newCategoryId;
                  }

                  const baseCategoryId = selectedCategoryId || prevCategories[0]?.id || null;
                  const existingOutcome =
                    prevGoals.find((g) => resolveGoalType(g) === "OUTCOME") || null;
                  let nextState = {
                    ...prev,
                    categories: nextCategories,
                    ui: { ...prevUi, selectedCategoryId: baseCategoryId },
                    profile: {
                      ...prev.profile,
                      name: cleanName,
                      whyText: cleanWhy,
                      whyImage: img || prev.profile.whyImage || "",
                    },
                  };

                  let outcomeId = existingOutcome?.id || null;
                  if (needsOutcome) {
                    outcomeId = uid();
                    nextState = createGoal(nextState, {
                      id: outcomeId,
                      categoryId: baseCategoryId,
                      title: cleanOutcome,
                      type: "OUTCOME",
                      planType: "STATE",
                      status: "queued",
                      startAt: `${todayKey()}T09:00`,
                      deadline: "",
                      weight: 0,
                      metric: null,
                    });
                  }

                  if (needsProcess) {
                    const processId = uid();
                    nextState = createGoal(nextState, {
                      id: processId,
                      categoryId: baseCategoryId,
                      title: cleanProcess,
                      type: "PROCESS",
                      planType: "ACTION",
                      status: "queued",
                      startAt: `${todayKey()}T09:00`,
                      freqCount: 3,
                      freqUnit: "WEEK",
                      cadence: cadenceFromUnit("WEEK"),
                      target: 3,
                      sessionMinutes: 30,
                      parentId: outcomeId || existingOutcome?.id || null,
                      weight: 100,
                    });
                  }

                  return {
                    ...nextState,
                    ui: {
                      ...(nextState.ui || {}),
                      mainGoalId: nextState.ui?.mainGoalId || outcomeId || existingOutcome?.id || null,
                    },
                  };
                });
                onDone();
              }}
            >
              Continuer
            </Button>

            <div className="small2">Stocké localement (localStorage).</div>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
