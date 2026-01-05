import React, { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Textarea } from "../components/UI";
import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";
import { createGoal } from "../logic/goals";
import { CATEGORY_TEMPLATES, findCategoryTemplateByLabel } from "../logic/templates";
import ScreenShell from "./_ScreenShell";

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

function cadenceFromUnit(unit) {
  if (unit === "DAY") return "DAILY";
  if (unit === "WEEK") return "WEEKLY";
  return "YEARLY";
}

function clampStep(value) {
  const v = Number.isFinite(value) ? value : 1;
  return Math.min(3, Math.max(1, v));
}

export default function Onboarding({ data, setData, onDone, planOnly = false }) {
  const safeData = data && typeof data === "object" ? data : {};
  const profile = safeData.profile || {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];

  const [step, setStep] = useState(() => {
    if (planOnly) return 3;
    const rawStep = Number(safeData.ui?.onboardingStep) || 1;
    return clampStep(rawStep);
  });

  useEffect(() => {
    if (planOnly) setStep(3);
  }, [planOnly]);

  const [firstName, setFirstName] = useState(profile.name || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [why, setWhy] = useState(profile.whyText || "");
  const [step1Error, setStep1Error] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryTemplateId, setCategoryTemplateId] = useState(null);
  const [outcomeTitle, setOutcomeTitle] = useState("");
  const [habitTitle, setHabitTitle] = useState("");
  const [step2Error, setStep2Error] = useState("");

  const [planChoice, setPlanChoice] = useState(profile.plan === "premium" ? "premium" : "free");

  let baseCategory = null;
  let baseOutcome = null;
  let baseHasHabit = false;

  for (const cat of categories) {
    const outcome = goals.find((g) => resolveGoalType(g) === "OUTCOME" && g.categoryId === cat.id) || null;
    if (!outcome) continue;
    const hasHabit = goals.some(
      (g) => resolveGoalType(g) === "PROCESS" && g.categoryId === cat.id && g.parentId === outcome.id
    );
    if (hasHabit) {
      baseCategory = cat;
      baseOutcome = outcome;
      baseHasHabit = true;
      break;
    }
  }

  if (!baseCategory && categories.length) {
    baseCategory =
      categories.find((c) => c.id === safeData.ui?.selectedCategoryId) ||
      categories[0] ||
      null;
  }

  if (baseCategory && !baseOutcome) {
    baseOutcome = goals.find((g) => resolveGoalType(g) === "OUTCOME" && g.categoryId === baseCategory.id) || null;
  }

  if (baseCategory && baseOutcome && !baseHasHabit) {
    baseHasHabit = goals.some(
      (g) => resolveGoalType(g) === "PROCESS" && g.categoryId === baseCategory.id && g.parentId === baseOutcome.id
    );
  }

  const needsCategory = categories.length === 0;
  const needsOutcome = !baseOutcome;
  const needsHabit = !baseHasHabit;

  const cleanFirstName = (firstName || "").trim();
  const cleanLastName = (lastName || "").trim();
  const cleanWhy = (why || "").trim();
  const cleanCategory = (categoryName || "").trim();
  const cleanOutcome = (outcomeTitle || "").trim();
  const cleanHabit = (habitTitle || "").trim();
  const selectedCategoryTemplate = categoryTemplateId
    ? CATEGORY_TEMPLATES.find((t) => t.id === categoryTemplateId)
    : null;

  const step1Valid = Boolean(cleanFirstName && cleanLastName && cleanWhy);
  const step2Ready =
    (!needsCategory || cleanCategory) && (!needsOutcome || cleanOutcome) && (!needsHabit || cleanHabit);

  const headerTitle = planOnly ? "Abonnement" : "Inscription";
  const headerSubtitle = planOnly ? "Choisis ton plan" : `Étape ${step}/3`;

  if (step === 1 && !planOnly) {
    return (
      <ScreenShell data={safeData} pageId="onboarding" headerTitle={headerTitle} headerSubtitle={headerSubtitle}>
        <Card accentBorder>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Engagement</div>
                <div className="small">Pas de discipline sans objectif. Écris pourquoi tu t’engages.</div>
              </div>
              <Badge>1/3</Badge>
            </div>

            <div className="mt14 col">
              <div>
                <div className="small" style={{ marginBottom: 6 }}>
                  Prénom
                </div>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6 }}>
                  Nom
                </div>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div>
                <div className="small" style={{ marginBottom: 6 }}>
                  Pourquoi
                </div>
                <Textarea value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Ton pourquoi" />
              </div>

              {step1Error ? <div className="small" style={{ color: "#ff9a9a" }}>{step1Error}</div> : null}

              <Button
                disabled={!step1Valid}
                onClick={() => {
                  if (!step1Valid) {
                    setStep1Error("Tous les champs sont requis.");
                    return;
                  }
                  setStep1Error("");
                  const nowIso = new Date().toISOString();
                  setData((prev) => {
                    const prevUi = prev.ui || {};
                    return {
                      ...prev,
                      profile: {
                        ...prev.profile,
                        name: cleanFirstName,
                        lastName: cleanLastName,
                        whyText: cleanWhy,
                        whyUpdatedAt: nowIso,
                      },
                      ui: { ...prevUi, onboardingStep: 2 },
                    };
                  });
                  setStep(2);
                }}
              >
                Suivant
              </Button>

              <div className="small2">Stocké localement (localStorage).</div>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  if (step === 2 && !planOnly) {
    return (
      <ScreenShell data={safeData} pageId="onboarding" headerTitle={headerTitle} headerSubtitle={headerSubtitle}>
        <Card accentBorder>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div className="titleSm">Démonstration guidée</div>
                <div className="small">Crée la base minimale pour commencer.</div>
              </div>
              <Badge>2/3</Badge>
            </div>

            <div className="mt14 col">
              <div className="listItem">
                <div className="titleSm">Créer ta première catégorie</div>
                {needsCategory ? (
                  <>
                    <Input
                      list="category-templates-onboarding"
                      value={categoryName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCategoryName(value);
                        const match = findCategoryTemplateByLabel(value);
                        setCategoryTemplateId(match ? match.id : null);
                      }}
                      placeholder="Nom de la catégorie"
                    />
                    <datalist id="category-templates-onboarding">
                      {CATEGORY_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.label} />
                      ))}
                    </datalist>
                    {selectedCategoryTemplate ? (
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div className="small2">Suggestion : {selectedCategoryTemplate.label}</div>
                        <button
                          className="linkBtn"
                          onClick={() => {
                            setCategoryTemplateId(null);
                            setCategoryName("");
                          }}
                        >
                          Créer la mienne
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="small2">Catégorie : {baseCategory?.name || "OK"}</div>
                )}
              </div>

              <div className="listItem">
                <div className="titleSm">Créer ton premier objectif</div>
                {needsOutcome ? (
                  <Input
                    value={outcomeTitle}
                    onChange={(e) => setOutcomeTitle(e.target.value)}
                    placeholder="Nom de l’objectif"
                  />
                ) : (
                  <div className="small2">Objectif : {baseOutcome?.title || "OK"}</div>
                )}
              </div>

              <div className="listItem">
                <div className="titleSm">Créer ta première action</div>
                {needsHabit ? (
                  <Input
                    value={habitTitle}
                    onChange={(e) => setHabitTitle(e.target.value)}
                    placeholder="Nom de l’action"
                  />
                ) : (
                  <div className="small2">Action : OK</div>
                )}
              </div>

              {step2Error ? <div className="small" style={{ color: "#ff9a9a" }}>{step2Error}</div> : null}

              <Button
                disabled={!step2Ready}
                onClick={() => {
                  if (!step2Ready) {
                    setStep2Error("Complète tous les champs requis.");
                    return;
                  }
                  setStep2Error("");
                  setData((prev) => {
                    const prevCategories = Array.isArray(prev.categories) ? prev.categories : [];
                    const prevUi = prev.ui || {};

                    let nextCategories = prevCategories;
                    let categoryId = baseCategory?.id || prevUi.selectedCategoryId || prevCategories[0]?.id || null;

                    if (needsCategory) {
                      const newCategoryId = uid();
                      nextCategories = [
                        ...prevCategories,
                        {
                          id: newCategoryId,
                          name: cleanCategory,
                          color: "#7C3AED",
                          wallpaper: "",
                          mainGoalId: null,
                          templateId: categoryTemplateId,
                        },
                      ];
                      categoryId = newCategoryId;
                    }

                    let nextState = {
                      ...prev,
                      categories: nextCategories,
                      ui: { ...prevUi, selectedCategoryId: categoryId, onboardingStep: 3 },
                    };

                    let outcomeId = baseOutcome?.id || null;
                    if (needsOutcome && categoryId) {
                    outcomeId = uid();
                    nextState = createGoal(nextState, {
                      id: outcomeId,
                      categoryId,
                      title: cleanOutcome,
                      type: "OUTCOME",
                      planType: "STATE",
                      status: "queued",
                      deadline: "",
                      weight: 0,
                      metric: null,
                    });
                  }

                    if (needsHabit && categoryId) {
                      const parentId = outcomeId || baseOutcome?.id || null;
                      if (parentId) {
                        const habitId = uid();
                        nextState = createGoal(nextState, {
                          id: habitId,
                          categoryId,
                          title: cleanHabit,
                          type: "PROCESS",
                          planType: "ACTION",
                          status: "queued",
                          startAt: `${todayKey()}T09:00`,
                          freqCount: 3,
                          freqUnit: "WEEK",
                          cadence: cadenceFromUnit("WEEK"),
                          target: 3,
                          sessionMinutes: 30,
                          parentId,
                          weight: 100,
                        });
                      }
                    }

                    const mainGoalId = outcomeId || baseOutcome?.id || null;
                    if (categoryId && mainGoalId) {
                      nextState = {
                        ...nextState,
                        categories: (nextState.categories || []).map((cat) =>
                          cat.id === categoryId ? { ...cat, mainGoalId } : cat
                        ),
                      };
                    }

                    return {
                      ...nextState,
                      ui: {
                        ...(nextState.ui || {}),
                        selectedCategoryId: categoryId || nextState.ui?.selectedCategoryId || null,
                        mainGoalId: nextState.ui?.mainGoalId || mainGoalId || null,
                        onboardingStep: 3,
                      },
                    };
                  });
                  setStep(3);
                }}
              >
                Terminer l’inscription
              </Button>
            </div>
          </div>
        </Card>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell data={safeData} pageId="onboarding" headerTitle={headerTitle} headerSubtitle={headerSubtitle}>
      <Card accentBorder>
        <div className="p18">
          <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="titleSm">Choisis ton plan</div>
              <div className="small">Aucune facturation ici. Tu pourras changer plus tard.</div>
            </div>
            <Badge>3/3</Badge>
          </div>

          <div className="mt14 grid2">
            <Card accentBorder style={{ borderColor: planChoice === "free" ? "#7C3AED" : "rgba(255,255,255,.16)" }}>
              <div className="p18 col">
                <div className="titleSm">Gratuit</div>
                <div className="small2">L’essentiel pour démarrer.</div>
                <Button
                  variant={planChoice === "free" ? "primary" : "ghost"}
                  onClick={() => setPlanChoice("free")}
                >
                  {planChoice === "free" ? "Sélectionné" : "Choisir Gratuit"}
                </Button>
              </div>
            </Card>

            <Card accentBorder style={{ borderColor: planChoice === "premium" ? "#7C3AED" : "rgba(255,255,255,.16)" }}>
              <div className="p18 col">
                <div className="titleSm">Premium</div>
                <div className="small2">Liberté totale et réglages avancés.</div>
                <Button
                  variant={planChoice === "premium" ? "primary" : "ghost"}
                  onClick={() => setPlanChoice("premium")}
                >
                  {planChoice === "premium" ? "Sélectionné" : "Choisir Premium"}
                </Button>
              </div>
            </Card>
          </div>

          <div className="mt12">
            <Button
              onClick={() => {
                setData((prev) => {
                  const prevUi = prev.ui || {};
                  const nextProfile = { ...prev.profile, plan: planChoice };
                  return {
                    ...prev,
                    profile: nextProfile,
                    ui: {
                      ...prevUi,
                      onboardingCompleted: planOnly ? prevUi.onboardingCompleted : true,
                      onboardingStep: 3,
                      showPlanStep: false,
                    },
                  };
                });
                if (typeof onDone === "function") onDone();
              }}
            >
              Accéder à l’app
            </Button>
          </div>
        </div>
      </Card>
    </ScreenShell>
  );
}
