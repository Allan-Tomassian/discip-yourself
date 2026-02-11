import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccentItem, Button, Card, IconButton, Input } from "../../components/UI";
import { safeConfirm, safePrompt } from "../../utils/dialogs";
import { addDays, startOfWeekKey, todayKey } from "../../utils/dates";
import { isPrimaryCategory, isPrimaryGoal, setPrimaryCategory } from "../../logic/priority";
import { resolveGoalType } from "../../domain/goalType";
import { linkProcessToOutcome, splitProcessByLink } from "../../logic/linking";
import { ensureSystemInboxCategory, SYSTEM_INBOX_ID } from "../../logic/state";
import { buildPlanningSections } from "../../utils/librarySections";
import { LABELS } from "../../ui/labels";

function getTourId(inlineEdit, value) {
  return inlineEdit ? undefined : value;
}

export default function CategoryManageInline({
  data,
  setData,
  categoryId,
  onOpenPilotage,
  onEditItem,
  onClose,
  inlineEdit = false,
}) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );
  const goals = useMemo(
    () => (Array.isArray(safeData.goals) ? safeData.goals : []),
    [safeData.goals]
  );
  const occurrences = useMemo(
    () => (Array.isArray(safeData.occurrences) ? safeData.occurrences : []),
    [safeData.occurrences]
  );
  const category = useMemo(
    () => categories.find((c) => c?.id === categoryId) || null,
    [categories, categoryId]
  );

  const [showWhy, setShowWhy] = useState(true);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState(null);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [whyDraft, setWhyDraft] = useState("");

  useEffect(() => {
    setNameDraft(category?.name || "");
    setWhyDraft(category?.whyText || "");
    setCategoryMenuOpen(false);
  }, [category?.id, category?.name, category?.whyText]);

  const outcomeGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "OUTCOME");
  }, [category?.id, goals]);

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

  const selectedOutcome = selectedOutcomeId
    ? outcomeGoals.find((g) => g.id === selectedOutcomeId) || null
    : null;

  const processGoals = useMemo(() => {
    if (!category?.id) return [];
    return goals.filter((g) => g.categoryId === category.id && resolveGoalType(g) === "PROCESS");
  }, [category?.id, goals]);

  const { linked: linkedHabits, unlinked: unlinkedHabits } = useMemo(() => {
    if (!processGoals.length) return { linked: [], unlinked: [] };
    if (!selectedOutcome?.id) return { linked: [], unlinked: processGoals };
    return splitProcessByLink(processGoals, selectedOutcome.id);
  }, [processGoals, selectedOutcome?.id]);

  const habitWeekStats = useMemo(() => {
    const stats = new Map();
    if (!processGoals.length) return stats;

    const weekStartKey = startOfWeekKey(new Date());
    const weekStartDate = new Date(`${weekStartKey}T12:00:00`);
    const weekKeys = Array.from({ length: 7 }, (_, i) => todayKey(addDays(weekStartDate, i)));
    const weekSet = new Set(weekKeys);

    const occurrenceStats = new Map();
    for (const occ of occurrences) {
      if (!occ || typeof occ.goalId !== "string" || typeof occ.date !== "string") continue;
      if (!weekSet.has(occ.date)) continue;
      const entry = occurrenceStats.get(occ.goalId) || { planned: 0, done: 0 };
      const status = occ.status || "planned";
      if (status !== "skipped") entry.planned += 1;
      if (status === "done") entry.done += 1;
      occurrenceStats.set(occ.goalId, entry);
    }

    for (const h of processGoals) {
      const occ = occurrenceStats.get(h.id) || { planned: 0, done: 0 };
      const planned = occ.planned;
      const done = occ.done;
      const ratio = planned ? Math.min(1, done / planned) : 0;
      stats.set(h.id, { planned, done, ratio });
    }

    return stats;
  }, [occurrences, processGoals]);

  const actionSections = useMemo(
    () => buildPlanningSections([...linkedHabits, ...unlinkedHabits], outcomeGoals),
    [linkedHabits, outcomeGoals, unlinkedHabits]
  );

  const commitName = useCallback(() => {
    if (!category?.id || typeof setData !== "function") return;
    const nextName = String(nameDraft || "").trim();
    if (!nextName) {
      setNameDraft(category.name || "");
      return;
    }
    if (nextName === String(category.name || "").trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, name: nextName } : cat
      ),
    }));
  }, [category?.id, category?.name, nameDraft, setData]);

  const commitWhy = useCallback(() => {
    if (!category?.id || typeof setData !== "function") return;
    const nextWhy = String(whyDraft || "");
    if (nextWhy === String(category.whyText || "")) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, whyText: nextWhy } : cat
      ),
    }));
  }, [category?.id, category?.whyText, setData, whyDraft]);

  useEffect(() => {
    if (!inlineEdit) return undefined;
    return () => {
      if (!category?.id || typeof setData !== "function") return;
      const nextName = String(nameDraft || "").trim();
      const currentName = String(category.name || "").trim();
      const nextWhy = String(whyDraft || "");
      const currentWhy = String(category.whyText || "");
      if (!nextName && nextWhy === currentWhy) return;
      if (nextName === currentName && nextWhy === currentWhy) return;
      setData((prev) => ({
        ...prev,
        categories: (prev.categories || []).map((cat) => {
          if (cat.id !== category.id) return cat;
          return {
            ...cat,
            ...(nextName ? { name: nextName } : null),
            ...(nextWhy !== currentWhy ? { whyText: nextWhy } : null),
          };
        }),
      }));
    };
  }, [inlineEdit, category?.id, category?.name, category?.whyText, nameDraft, setData, whyDraft]);

  function linkHabitToSelectedOutcome(habitId) {
    if (!selectedOutcome?.id || typeof setData !== "function") return;
    setData((prev) => linkProcessToOutcome(prev, habitId, selectedOutcome.id));
  }

  function openPilotage() {
    if (typeof onOpenPilotage === "function") onOpenPilotage();
  }

  function renameCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const nextName = safePrompt("Renommer la catégorie :", category.name || "");
    if (!nextName || !nextName.trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, name: nextName.trim() } : cat
      ),
    }));
  }

  function recolorCategory() {
    if (!category?.id || typeof setData !== "function") return;
    const nextColor = safePrompt("Couleur (hex) :", category.color || "#7C3AED");
    if (!nextColor || !nextColor.trim()) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, color: nextColor.trim() } : cat
      ),
    }));
  }

  function editMiniWhy() {
    if (!category?.id || typeof setData !== "function") return;
    const nextWhy = safePrompt("Mini-why :", category.whyText || "");
    if (nextWhy == null) return;
    setData((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((cat) =>
        cat.id === category.id ? { ...cat, whyText: String(nextWhy) } : cat
      ),
    }));
  }

  function setCategoryPriority() {
    if (!category?.id || typeof setData !== "function") return;
    setData((prev) => setPrimaryCategory(prev, category.id));
  }

  function deleteCategory() {
    if (!category?.id || typeof setData !== "function") return;
    if (category.id === SYSTEM_INBOX_ID) return;
    const ok = safeConfirm("Supprimer cette catégorie ? Les éléments seront déplacés vers Général.");
    if (!ok) return;
    setData((prev) => {
      let next = prev;
      const ensured = ensureSystemInboxCategory(next);
      next = ensured.state;
      const sysId = ensured.category?.id || SYSTEM_INBOX_ID;
      const nextCategories = (next.categories || []).filter((cat) => cat.id !== category.id);
      const nextGoals = (next.goals || []).map((g) =>
        g && g.categoryId === category.id ? { ...g, categoryId: sysId } : g
      );
      const nextHabits = (next.habits || []).map((h) =>
        h && h.categoryId === category.id ? { ...h, categoryId: sysId } : h
      );
      const nextUi = { ...(next.ui || {}) };
      if (nextUi.selectedCategoryId === category.id) nextUi.selectedCategoryId = sysId;
      if (nextUi.selectedCategoryByView) {
        const scv = { ...nextUi.selectedCategoryByView };
        if (scv.library === category.id) scv.library = sysId;
        if (scv.plan === category.id) scv.plan = sysId;
        if (scv.home === category.id) scv.home = sysId;
        scv.pilotage = scv.pilotage === category.id ? sysId : scv.pilotage;
        nextUi.selectedCategoryByView = scv;
      }
      return {
        ...next,
        categories: nextCategories,
        goals: nextGoals,
        habits: nextHabits,
        ui: nextUi,
      };
    });
    if (typeof onClose === "function") onClose();
  }

  function deleteOutcome(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm(`Supprimer ce ${LABELS.goalLower} ?`);
    if (!ok) return;
    setData((prev) => {
      const nextGoals = (prev.goals || [])
        .filter((g) => g && g.id !== goal.id)
        .map((g) =>
          g && g.parentId === goal.id ? { ...g, parentId: null, outcomeId: null } : g
        );
      const nextCategories = (prev.categories || []).map((cat) =>
        cat.mainGoalId === goal.id ? { ...cat, mainGoalId: null } : cat
      );
      return { ...prev, goals: nextGoals, categories: nextCategories };
    });
  }

  function deleteAction(goal) {
    if (!goal?.id || typeof setData !== "function") return;
    const ok = safeConfirm("Supprimer cette action ?");
    if (!ok) return;
    const goalId = goal.id;
    setData((prev) => {
      const nextGoals = (prev.goals || []).filter((g) => g && g.id !== goalId);
      const nextOccurrences = (prev.occurrences || []).filter((o) => o && o.goalId !== goalId);
      const nextReminders = (prev.reminders || []).filter((r) => r && r.goalId !== goalId);
      const nextSessions = Array.isArray(prev.sessions)
        ? prev.sessions
            .map((s) => {
              if (!s || typeof s !== "object") return s;
              const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => id !== goalId) : [];
              const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => id !== goalId) : [];
              return { ...s, habitIds, doneHabitIds };
            })
            .filter((s) => {
              if (!s || typeof s !== "object") return false;
              const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
              const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
              return hasHabits || hasDone;
            })
        : prev.sessions;
      let nextChecks = prev.checks;
      if (nextChecks && typeof nextChecks === "object") {
        const cleaned = {};
        for (const [key, bucket] of Object.entries(nextChecks)) {
          const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => id !== goalId) : [];
          const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
          if (habits.length || Object.keys(micro).length) cleaned[key] = { ...bucket, habits, micro };
        }
        nextChecks = cleaned;
      }
      const nextUi = { ...(prev.ui || {}) };
      if (nextUi.activeSession?.habitIds) {
        const kept = nextUi.activeSession.habitIds.filter((id) => id !== goalId);
        nextUi.activeSession = kept.length ? { ...nextUi.activeSession, habitIds: kept } : null;
      }
      if (nextUi.sessionDraft?.objectiveId === goalId) nextUi.sessionDraft = null;
      return {
        ...prev,
        goals: nextGoals,
        occurrences: nextOccurrences,
        reminders: nextReminders,
        sessions: nextSessions,
        checks: nextChecks,
        ui: nextUi,
      };
    });
  }

  function unlinkAction(goalId) {
    if (!goalId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      goals: (prev.goals || []).map((g) =>
        g && g.id === goalId ? { ...g, parentId: null, outcomeId: null } : g
      ),
    }));
  }

  function openEditItem(item) {
    if (!item) return;
    const type = resolveGoalType(item);
    if (typeof onEditItem === "function") {
      onEditItem({ id: item.id, type, categoryId: item.categoryId || null });
    }
  }

  if (!category) {
    return (
      <Card accentBorder>
        <div className="p18">
          <div className="titleSm">Catégorie introuvable</div>
          <div className="small2 mt6">Cette catégorie n’existe plus.</div>
        </div>
      </Card>
    );
  }

  const whyText = (category.whyText || "").trim();
  const whyDisplay = whyText || "Aucun mini-why pour cette catégorie.";

  return (
    <div className="stack stackGap12" style={{ "--catColor": category.color || "#7C3AED" }}>
      <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-category-card")}>
        <div className="p18 stack stackGap12">
          <div className="row rowBetween alignCenter">
            <div>
              <div className="titleSm">Catégorie</div>
              {inlineEdit ? (
                <div className="row gap8 alignCenter mt8">
                  <Input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={commitName}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitName();
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label="Nom de la catégorie"
                    data-testid={`library-manage-name-${category.id}`}
                  />
                  {isPrimaryCategory(category) ? (
                    <span className="badge badgeAccent">Prioritaire</span>
                  ) : null}
                </div>
              ) : (
                <div className="small2">
                  {category.name || "Catégorie"}
                  {isPrimaryCategory(category) ? (
                    <span className="badge badgeAccent ml8">Prioritaire</span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="row gap8">
              <IconButton
                icon="gear"
                aria-label="Paramètres catégorie"
                onClick={() => {
                  setCategoryMenuOpen((prev) => !prev);
                }}
                data-tour-id={getTourId(inlineEdit, "manage-category-settings")}
              />
              <IconButton
                icon="close"
                className="iconBtnDanger"
                aria-label="Supprimer la catégorie"
                onClick={deleteCategory}
                data-tour-id={getTourId(inlineEdit, "manage-category-delete")}
              />
            </div>
          </div>
          {categoryMenuOpen ? (
            <div className="stack stackGap12">
              {!inlineEdit ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    renameCategory();
                    setCategoryMenuOpen(false);
                  }}
                  data-tour-id={getTourId(inlineEdit, "manage-category-rename")}
                >
                  Renommer
                </Button>
              ) : null}
              <Button
                variant="ghost"
                onClick={() => {
                  recolorCategory();
                  setCategoryMenuOpen(false);
                }}
              >
                Modifier la couleur
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCategoryPriority();
                  setCategoryMenuOpen(false);
                }}
                disabled={isPrimaryCategory(category)}
                data-tour-id={getTourId(inlineEdit, "manage-category-priority")}
              >
                {isPrimaryCategory(category) ? "Prioritaire" : "Définir comme prioritaire"}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-mini-why")}>
        <div className="p18 stack stackGap12">
          <div className="row rowBetween alignCenter">
            <div>
              <div className="titleSm">Mini-why</div>
              <div className="small2">Visible pour cette catégorie</div>
            </div>
            <button
              className="linkBtn"
              onClick={() => setShowWhy((v) => !v)}
              data-tour-id={getTourId(inlineEdit, "manage-mini-why-toggle")}
            >
              {showWhy ? "Masquer" : "Afficher"}
            </button>
          </div>
          {showWhy ? (
            inlineEdit ? (
              <textarea
                className="input"
                rows={3}
                value={whyDraft}
                onChange={(event) => setWhyDraft(event.target.value)}
                onBlur={commitWhy}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    commitWhy();
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Mini-why"
                data-testid={`library-manage-why-${category.id}`}
              />
            ) : (
              <div className="small2">{whyDisplay}</div>
            )
          ) : null}
          <div className="row rowEnd">
            {inlineEdit ? (
              <Button variant="ghost" onClick={commitWhy}>
                Sauver
              </Button>
            ) : (
              <Button variant="ghost" onClick={editMiniWhy}>
                Éditer
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-objectives-section")}>
        <div className="p18 stack stackGap12">
          <div className="titleSm">{LABELS.goals}</div>
          {outcomeGoals.length ? (
            <div className="stack stackGap12">
              {outcomeGoals.map((g) => (
                <AccentItem key={g.id} color={category.color || "#7C3AED"}>
                  <div className="minW0">
                    <div className="itemTitle">
                      {g.title || LABELS.goal}
                      {isPrimaryGoal(g) ? (
                        <span className="badge badgeAccent ml8">Prioritaire</span>
                      ) : null}
                    </div>
                    <div className="itemSub">{g.id === category.mainGoalId ? "Principal" : "Secondaire"}</div>
                  </div>
                  <div className="row gap8">
                    <IconButton
                      icon="gear"
                      aria-label={`Paramètres ${LABELS.goalLower}`}
                      onClick={() => openEditItem(g)}
                    />
                    <IconButton
                      icon="close"
                      aria-label={`Supprimer le ${LABELS.goalLower}`}
                      onClick={() => deleteOutcome(g)}
                    />
                  </div>
                </AccentItem>
              ))}
            </div>
          ) : (
            <div className="stack stackGap12">
              <div className="small2">Aucun {LABELS.goalLower} dans cette catégorie.</div>
            </div>
          )}
        </div>
      </Card>

      <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-actions-section")}>
        <div className="p18 stack stackGap12">
          <div className="titleSm">Actions</div>
          {actionSections.length ? (
            <div className="stack stackGap12">
              {actionSections.map((section) => (
                <div key={section.key} className="stack stackGap12">
                  <div className="small2 textMuted">{section.title}</div>
                  {section.items.map(({ goal, badges }) => {
                    const stat = habitWeekStats.get(goal.id) || { planned: 0, done: 0, ratio: 0 };
                    const linkedToSelected =
                      selectedOutcome?.id &&
                      (goal.parentId === selectedOutcome.id ||
                        goal.primaryGoalId === selectedOutcome.id ||
                        goal.outcomeId === selectedOutcome.id);
                    const showLink = linkedToSelected || Boolean(selectedOutcome?.id);
                    return (
                      <AccentItem key={goal.id} color={category.color || "#7C3AED"}>
                        <div className="stack gap6 minW0 wFull">
                          <div className="row rowBetween alignCenter">
                            <div className="itemTitle">{goal.title || "Action"}</div>
                            <div className="row gap8">
                              <IconButton
                                icon="gear"
                                aria-label="Paramètres action"
                                onClick={() => openEditItem(goal)}
                              />
                              {showLink ? (
                                linkedToSelected ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => unlinkAction(goal.id)}
                                    disabled={!goal.parentId && !goal.outcomeId}
                                  >
                                    Délier
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    onClick={() => linkHabitToSelectedOutcome(goal.id)}
                                    disabled={!selectedOutcome?.id || typeof setData !== "function"}
                                  >
                                    Lier
                                  </Button>
                                )
                              ) : null}
                              <IconButton
                                icon="close"
                                aria-label="Supprimer l’action"
                                onClick={() => deleteAction(goal)}
                              />
                            </div>
                          </div>
                          {badges.length ? (
                            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                              {badges.map((label, idx) => (
                                <span key={`${goal.id}-badge-${idx}`} className="badge">
                                  {label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="itemSub">{`Cette semaine : ${stat.done} terminées · ${stat.done}/${stat.planned}`}</div>
                          <div className="progressTrack">
                            <div
                              className="progressFill"
                              style={{
                                width: `${Math.round(stat.ratio * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </AccentItem>
                    );
                  })}
                </div>
              ))}
              {!selectedOutcome?.id ? (
                <div className="small2 textMuted">Sélectionne un {LABELS.goalLower} pour lier ces actions.</div>
              ) : null}
            </div>
          ) : (
            <div className="stack stackGap12">
              <div className="small2">Aucune action dans cette catégorie.</div>
            </div>
          )}
        </div>
      </Card>

      <Card accentBorder data-tour-id={getTourId(inlineEdit, "manage-pilotage-section")}>
        <div className="p18 stack stackGap12">
          <div className="titleSm">Pilotage</div>
          <div className="small2">Etat, charge et discipline (lecture seule).</div>
          <Button variant="ghost" onClick={openPilotage} data-tour-id={getTourId(inlineEdit, "manage-open-pilotage")}>
            Ouvrir le pilotage
          </Button>
        </div>
      </Card>
    </div>
  );
}
