import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Card } from "../components/UI";
import AccentItem from "../components/AccentItem";
import {
  getCategoryPilotageCounts,
  getCategoryStatus,
  getCategoryWeekBreakdown,
  getDisciplineStreak7d,
  getDisciplineSummary,
  getLoadSummary,
} from "../logic/pilotage";
import SortableBlocks from "../components/SortableBlocks";
import { getDefaultBlockIds } from "../logic/blocks/registry";

// TOUR MAP:
// - primary_action: planifier depuis l'état des catégories
// - key_elements: category status list, load summary, discipline summary
// - optional_elements: empty-today planifier CTA
const STATUS_LABELS = {
  EMPTY: "Vide",
  DONE: "Terminée",
  ACTIVE: "Active",
};

// Statuts = couleurs fixes (ne dépendent pas de la catégorie)
const STATUS_STYLES = {
  ACTIVE: {
    backgroundColor: "rgba(76, 175, 80, 0.14)",
    borderColor: "rgba(76, 175, 80, 0.8)",
    color: "#EAF7ED",
  },
  DONE: {
    backgroundColor: "rgba(158, 158, 158, 0.14)",
    borderColor: "rgba(158, 158, 158, 0.7)",
    color: "#F0F0F0",
  },
  EMPTY: {
    backgroundColor: "rgba(255, 152, 0, 0.14)",
    borderColor: "rgba(255, 152, 0, 0.8)",
    color: "#FFF4E5",
  },
};

const DEFAULT_PILOTAGE_ORDER = getDefaultBlockIds("pilotage");
const PILOTAGE_BLOCKS = {
  "pilotage.categories": { id: "pilotage.categories" },
  "pilotage.charge": { id: "pilotage.charge" },
  "pilotage.discipline": { id: "pilotage.discipline" },
};

const arrayEqual = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((id, idx) => id === b[idx]);

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const pct = (done, expected) => {
  const d = Number(done) || 0;
  const e = Number(expected) || 0;
  if (e <= 0) return null;
  return Math.round((d / e) * 100);
};

const remainingCount = (bucket) => {
  if (!bucket || typeof bucket !== "object") return 0;
  const v = bucket.remaining ?? bucket.planned;
  return Number(v) || 0;
};

function Meter({ value01 = 0, label = "", tone = "accent" }) {
  const v = clamp01(value01);
  const track = "rgba(255,255,255,0.10)";
  const fill =
    tone === "good"
      ? "rgba(76, 175, 80, 0.75)"
      : tone === "warn"
        ? "rgba(255, 152, 0, 0.80)"
        : tone === "bad"
          ? "rgba(244, 67, 54, 0.78)"
          : "rgba(124, 58, 237, 0.78)";
  return (
    <div className="col" style={{ gap: 8 }}>
      {label ? <div className="small2 textMuted">{label}</div> : null}
      <div
        aria-hidden="true"
        style={{
          width: "100%",
          height: 10,
          borderRadius: 999,
          background: track,
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            width: `${Math.round(v * 100)}%`,
            height: "100%",
            borderRadius: 999,
            background: fill,
          }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value, right = null }) {
  return (
    <div
      className="row"
      style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}
    >
      <div className="itemTitle">{label}</div>
      <div className="row" style={{ alignItems: "center", gap: 10 }}>
        {right}
        <div className="itemSub" style={{ textAlign: "right" }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default function Pilotage({
  data,
  setData,
  generationWindowDays = null,
  isPlanningUnlimited = false,
}) {
  const safeData = useMemo(() => (data && typeof data === "object" ? data : {}), [data]);
  const categories = useMemo(
    () => (Array.isArray(safeData.categories) ? safeData.categories : []),
    [safeData.categories]
  );

  const now = useMemo(() => {
    void safeData;
    return new Date();
  }, [safeData]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      map.set(c.id, getCategoryPilotageCounts(safeData, c.id));
    }
    return map;
  }, [categories, safeData]);

  const statusByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      map.set(c.id, getCategoryStatus(safeData, c.id, now));
    }
    return map;
  }, [categories, safeData, now]);

  const loadSummary = useMemo(() => getLoadSummary(safeData, now), [safeData, now]);
  const disciplineSummary = useMemo(() => getDisciplineSummary(safeData, now), [safeData, now]);

  const selectedCategoryId =
    safeData?.ui?.selectedCategoryByView?.pilotage || categories?.[0]?.id || null;

  const [disciplineWindow, setDisciplineWindow] = useState("7d");

  const disciplineModel = useMemo(() => {
    const is30 = disciplineWindow === "30d";
    const score = is30
      ? Number(disciplineSummary?.disciplineScore30d)
      : Number(disciplineSummary?.disciplineScore7d);
    const expected = is30
      ? Number(disciplineSummary?.disciplineExpected30d)
      : Number(disciplineSummary?.disciplineExpected7d);
    const missed = is30
      ? Number(disciplineSummary?.disciplineMissed30d)
      : Number(disciplineSummary?.disciplineMissed7d);
    const done = is30
      ? Number(disciplineSummary?.disciplineDone30d)
      : Number(disciplineSummary?.disciplineDone7d);

    return {
      window: disciplineWindow,
      score: Number.isFinite(score) ? score : 100,
      expected: Number.isFinite(expected) ? expected : 0,
      missed: Number.isFinite(missed) ? missed : 0,
      done: Number.isFinite(done) ? done : 0,
    };
  }, [disciplineSummary, disciplineWindow]);

  const disciplineScore = disciplineModel.score;

  const todayPct = useMemo(
    () => pct(loadSummary?.today?.done, loadSummary?.today?.expected),
    [loadSummary]
  );
  const weekPct = useMemo(
    () => pct(loadSummary?.week?.done, loadSummary?.week?.expected),
    [loadSummary]
  );

  const todayRemaining = useMemo(() => remainingCount(loadSummary?.today), [loadSummary]);
  const weekRemaining = useMemo(() => remainingCount(loadSummary?.week), [loadSummary]);

  const todayExpected = Number(loadSummary?.today?.expected) || 0;
  const todayDone = Number(loadSummary?.today?.done) || 0;
  const weekExpected = Number(loadSummary?.week?.expected) || 0;
  const weekDone = Number(loadSummary?.week?.done) || 0;
  const weekMissed = Number(loadSummary?.week?.missed) || 0;

  const disciplineTone = useMemo(() => {
    if (disciplineScore >= 95) return "good";
    if (disciplineScore >= 80) return "warn";
    return "bad";
  }, [disciplineScore]);

  const disciplineInsights = useMemo(() => {
    const items = [];
    const cancelled = Number(disciplineSummary?.cancelledSessions7d) || 0;
    const noExec = Number(disciplineSummary?.noExecutionDays7d) || 0;

    const expected = disciplineModel.expected;
    const missed = disciplineModel.missed;

    if (expected === 0) {
      items.push({
        tone: "warn",
        title: `Aucune occurrence attendue (${disciplineModel.window})`,
        detail:
          "Sans occurrence attendue, la discipline reste à 100% mais tu ne progresses pas. Planifie au moins 1 action récurrente clé.",
      });
    } else if (missed > 0) {
      items.push({
        tone: "bad",
        title: `${missed} occurrence${missed > 1 ? "s" : ""} manquée${missed > 1 ? "s" : ""} (${disciplineModel.window})`,
        detail: "Ton score baisse uniquement quand une occurrence attendue n'est pas exécutée.",
      });
    } else {
      items.push({
        tone: "good",
        title: "Fenêtre parfaite",
        detail: "Aucune occurrence manquée sur la période sélectionnée.",
      });
    }

    if (noExec > 0) {
      items.push({
        tone: "warn",
        title: `${noExec} jour${noExec > 1 ? "s" : ""} sans exécution (7j)`,
        detail: "Objectif : 0. Même 1 action simple compte.",
      });
    }

    if (cancelled > 0) {
      items.push({
        tone: "warn",
        title: `${cancelled} session${cancelled > 1 ? "s" : ""} annulée${cancelled > 1 ? "s" : ""} (7j)`,
        detail: "Trop d'annulations = plan trop ambitieux ou mal placé.",
      });
    }

    return items;
  }, [disciplineSummary, disciplineModel]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId]
  );

  const selectedCounts = useMemo(() => {
    if (!selectedCategoryId) return null;
    return countsByCategory.get(selectedCategoryId) || null;
  }, [countsByCategory, selectedCategoryId]);

  const selectedStatus = useMemo(() => {
    if (!selectedCategoryId) return null;
    return statusByCategory.get(selectedCategoryId) || null;
  }, [statusByCategory, selectedCategoryId]);

  const selectedWeek = useMemo(() => {
    if (!selectedCategoryId) return null;
    return getCategoryWeekBreakdown(safeData, selectedCategoryId, now);
  }, [safeData, selectedCategoryId, now]);

  const streak7d = useMemo(() => getDisciplineStreak7d(safeData, now), [safeData, now]);

  const blockOrder = useMemo(() => {
    const raw = safeData?.ui?.blocksByPage?.pilotage;
    const ids = Array.isArray(raw)
      ? raw.map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean)
      : [];
    const cleaned = [];
    const seen = new Set();
    let hasInvalid = false;
    let hasDuplicate = false;
    let hasMissing = false;
    for (const id of ids) {
      if (!DEFAULT_PILOTAGE_ORDER.includes(id)) {
        hasInvalid = true;
        continue;
      }
      if (seen.has(id)) {
        hasDuplicate = true;
        continue;
      }
      seen.add(id);
      cleaned.push(id);
    }
    for (const id of DEFAULT_PILOTAGE_ORDER) {
      if (!seen.has(id)) {
        if (ids.length) hasMissing = true;
        cleaned.push(id);
      }
    }
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env?.DEV &&
      (hasInvalid || hasDuplicate || hasMissing)
    ) {
      // eslint-disable-next-line no-console
      console.warn("[pilotage] invalid or duplicate block ids in blocksByPage.pilotage");
    }
    return cleaned.length ? cleaned : [...DEFAULT_PILOTAGE_ORDER];
  }, [safeData?.ui?.blocksByPage?.pilotage]);

  const blockItems = useMemo(
    () => blockOrder.map((id) => PILOTAGE_BLOCKS[id]).filter(Boolean),
    [blockOrder]
  );

  const showPlanningCta = Boolean(categories.length && (Number(loadSummary?.week?.expected) || 0) === 0);

  const handleReorder = useCallback(
    (nextItems) => {
      if (typeof setData !== "function") return;
      const nextIds = Array.isArray(nextItems)
        ? nextItems.map((item) => item?.id).filter(Boolean)
        : [];
      const deduped = [];
      const seen = new Set();
      for (const id of nextIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        deduped.push(id);
      }
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevBlocksByPage =
          prevUi.blocksByPage && typeof prevUi.blocksByPage === "object" ? prevUi.blocksByPage : {};
        const prevPilotage = Array.isArray(prevBlocksByPage.pilotage) ? prevBlocksByPage.pilotage : [];
        const prevIds = prevPilotage.map((b) => (typeof b === "string" ? b : b?.id)).filter(Boolean);
        if (arrayEqual(prevIds, deduped)) return prev;

        const byId = new Map(
          prevPilotage
            .map((b) => (b && typeof b === "object" ? b : null))
            .filter(Boolean)
            .map((b) => [b.id, b])
        );
        const nextPilotage = deduped.map((id) => {
          const existing = byId.get(id);
          return {
            ...(existing || { id, enabled: true }),
            id,
            enabled: existing ? existing.enabled !== false : true,
          };
        });
        return {
          ...prev,
          ui: {
            ...prevUi,
            blocksByPage: {
              ...prevBlocksByPage,
              pilotage: nextPilotage,
            },
          },
        };
      });
    },
    [setData]
  );

  const setPilotageSelectedCategory = useCallback(
    (categoryId) => {
      if (!categoryId || typeof setData !== "function") return;
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevSel =
          prevUi?.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        if (prevSel?.pilotage === categoryId) return prev;
        return {
          ...prev,
          ui: {
            ...prevUi,
            selectedCategoryByView: {
              ...prevSel,
              pilotage: categoryId,
            },
          },
        };
      });
    },
    [setData]
  );

  useEffect(() => {
    if (typeof setData !== "function") return;

    if (!categories.length) {
      setData((prev) => {
        const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
        const prevSel =
          prevUi?.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        if (prevSel?.pilotage == null) return prev;
        return {
          ...prev,
          ui: {
            ...prevUi,
            selectedCategoryByView: {
              ...prevSel,
              pilotage: null,
            },
          },
        };
      });
      return;
    }

    const current = safeData?.ui?.selectedCategoryByView?.pilotage || null;
    const exists = current ? categories.some((c) => c.id === current) : false;
    if (!exists) {
      setPilotageSelectedCategory(categories[0].id);
    }
  }, [categories, safeData?.ui?.selectedCategoryByView?.pilotage, setData, setPilotageSelectedCategory]);

  const getCategoryColor = useCallback((c) => {
    return c?.color || c?.accentColor || c?.hex || c?.themeColor || "#6EE7FF";
  }, []);

  return (
    <ScreenShell
      headerTitle={<span data-tour-id="pilotage-title">Pilotage</span>}
      headerSubtitle="Vue d'ensemble"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <SortableBlocks
        items={blockItems}
        getId={(item) => item.id}
        onReorder={handleReorder}
        className="stack stackGap12"
        renderItem={(item, drag) => {
          const blockId = item?.id;
          const { attributes, listeners, setActivatorNodeRef } = drag || {};

          if (blockId === "pilotage.categories") {
            return (
              <Card data-tour-id="pilotage-category-status">
                <div className="p18">
                  <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <div className="row" style={{ alignItems: "center", gap: 8 }}>
                      {drag ? (
                        <button
                          ref={setActivatorNodeRef}
                          {...listeners}
                          {...attributes}
                          className="dragHandle"
                          aria-label="Réorganiser"
                        >
                          ⋮⋮
                        </button>
                      ) : null}
                      <div className="sectionTitle">État des catégories</div>
                    </div>
                  </div>

                  <div className="mt12 col" role="list" style={{ gap: 10 }}>
                    {categories.map((c) => {
                      const counts = countsByCategory.get(c.id) || { activeOutcomesCount: 0, processCount: 0 };
                      const label = statusByCategory.get(c.id) || "ACTIVE";
                      const summary =
                        counts.activeOutcomesCount || counts.processCount
                          ? `${counts.activeOutcomesCount} objectifs · ${counts.processCount} actions`
                          : "Aucun élément";

                      const isSelected = selectedCategoryId === c.id;
                      const catColor = getCategoryColor(c);
                      const statusStyle = STATUS_STYLES[label] || STATUS_STYLES.ACTIVE;

                      return (
                        <AccentItem
                          key={c.id}
                          color={catColor}
                          selected={isSelected}
                          onClick={() => setPilotageSelectedCategory(c.id)}
                          aria-label={`Catégorie ${c.name || "Catégorie"} (${STATUS_LABELS[label] || "Active"})`}
                          rightSlot={
                            <span
                              className="badge"
                              aria-label={`Statut: ${STATUS_LABELS[label] || "Active"}`}
                              style={{ ...statusStyle, borderWidth: 1, borderStyle: "solid" }}
                            >
                              {STATUS_LABELS[label] || "Active"}
                            </span>
                          }
                        >
                          <div>
                            <div className="itemTitle">{c.name || "Catégorie"}</div>
                            <div className="itemSub">{summary}</div>
                          </div>
                        </AccentItem>
                      );
                    })}
                  </div>

                  {selectedCategory ? (
                    <div className="mt14" style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div className="sectionTitle">Focus</div>
                          <div className="small2 textMuted">Catégorie sélectionnée</div>
                        </div>
                        {selectedStatus ? (
                          <span
                            className="badge"
                            style={{
                              ...(STATUS_STYLES[selectedStatus] || STATUS_STYLES.ACTIVE),
                              borderWidth: 1,
                              borderStyle: "solid",
                            }}
                          >
                            {STATUS_LABELS[selectedStatus] || "Active"}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt10 col" style={{ gap: 10 }}>
                        <StatRow
                          label={selectedCategory?.name || "Catégorie"}
                          value={
                            selectedCounts
                              ? `${selectedCounts.activeOutcomesCount || 0} objectifs · ${selectedCounts.processCount || 0} actions`
                              : "—"
                          }
                        />
                        <StatRow
                          label="Semaine (attendu / fait)"
                          value={selectedWeek ? `${selectedWeek.expected || 0} / ${selectedWeek.done || 0}` : "—"}
                          right={
                            selectedWeek && (selectedWeek.missed || 0) > 0 ? (
                              <span
                                className="badge"
                                style={{ ...STATUS_STYLES.EMPTY, borderWidth: 1, borderStyle: "solid" }}
                              >
                                {selectedWeek.missed} manquée{selectedWeek.missed > 1 ? "s" : ""}
                              </span>
                            ) : null
                          }
                        />
                        <div className="small2 textMuted">
                          Conseil : vise 1 objectif actif + 1 à 3 actions récurrentes. Le reste = bruit.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          }

          if (blockId === "pilotage.charge") {
            return (
              <Card data-tour-id="pilotage-load">
                <div className="p18">
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    {drag ? (
                      <button
                        ref={setActivatorNodeRef}
                        {...listeners}
                        {...attributes}
                        className="dragHandle"
                        aria-label="Réorganiser"
                      >
                        ⋮⋮
                      </button>
                    ) : null}
                    <div className="sectionTitle">Charge</div>
                  </div>

                  <div className="mt12 col" style={{ gap: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div className="itemTitle">Aujourd'hui</div>
                      <div className="row" style={{ alignItems: "center", gap: 8 }}>
                        {todayExpected > 0 ? (
                          <span className="badge" style={{ ...STATUS_STYLES.ACTIVE, borderWidth: 1, borderStyle: "solid" }}>
                            {todayDone}/{todayExpected}
                          </span>
                        ) : (
                          <span className="badge" style={{ ...STATUS_STYLES.DONE, borderWidth: 1, borderStyle: "solid" }}>
                            0 attendue
                          </span>
                        )}
                        {todayRemaining > 0 ? (
                          <span className="badge" style={{ ...STATUS_STYLES.EMPTY, borderWidth: 1, borderStyle: "solid" }}>
                            {todayRemaining} restante{todayRemaining > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div className="itemTitle">Cette semaine</div>
                      <div className="row" style={{ alignItems: "center", gap: 8 }}>
                        {weekExpected > 0 ? (
                          <span className="badge" style={{ ...STATUS_STYLES.ACTIVE, borderWidth: 1, borderStyle: "solid" }}>
                            {weekDone}/{weekExpected}
                          </span>
                        ) : (
                          <span className="badge" style={{ ...STATUS_STYLES.DONE, borderWidth: 1, borderStyle: "solid" }}>
                            0 attendue
                          </span>
                        )}
                        {weekRemaining > 0 ? (
                          <span className="badge" style={{ ...STATUS_STYLES.EMPTY, borderWidth: 1, borderStyle: "solid" }}>
                            {weekRemaining} restante{weekRemaining > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {weekMissed > 0 ? (
                          <span className="badge" style={{
                            backgroundColor: "rgba(244,67,54,0.14)",
                            borderColor: "rgba(244,67,54,0.8)",
                            color: "#FFECEC",
                            borderWidth: 1,
                            borderStyle: "solid",
                          }}>
                            {weekMissed} manquée{weekMissed > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt6 col" style={{ gap: 12 }}>
                      <Meter
                        label={todayPct == null ? "Aujourd’hui · aucune occurrence attendue" : `Aujourd’hui · ${todayPct}%`}
                        value01={todayPct == null ? 0 : todayPct / 100}
                        tone={todayPct == null ? "accent" : todayPct >= 95 ? "good" : todayPct >= 80 ? "warn" : "bad"}
                      />
                      <Meter
                        label={weekPct == null ? "Cette semaine · aucune occurrence attendue" : `Cette semaine · ${weekPct}%`}
                        value01={weekPct == null ? 0 : weekPct / 100}
                        tone={weekPct == null ? "accent" : weekPct >= 95 ? "good" : weekPct >= 80 ? "warn" : "bad"}
                      />
                    </div>

                    {showPlanningCta ? (
                      <div className="mt10">
                        <div className="small2 textMuted">
                          {isPlanningUnlimited
                            ? "Planning illimité : aucune occurrence attendue pour le moment."
                            : Number.isFinite(generationWindowDays) && generationWindowDays > 0
                              ? `0 occurrence attendue sur ${Math.floor(generationWindowDays)} jours.`
                              : "0 occurrence attendue sur les prochains jours."}
                        </div>
                        <div className="mt8 small2 textMuted">Utilise le bouton + pour créer une action attendue.</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          }

          if (blockId === "pilotage.discipline") {
            return (
              <Card data-tour-id="pilotage-discipline">
                <div className="p18">
                  <div className="row" style={{ alignItems: "center", gap: 8 }}>
                    {drag ? (
                      <button
                        ref={setActivatorNodeRef}
                        {...listeners}
                        {...attributes}
                        className="dragHandle"
                        aria-label="Réorganiser"
                      >
                        ⋮⋮
                      </button>
                    ) : null}
                    <div className="sectionTitle">Discipline</div>
                  </div>

                  <div className="mt12 col" style={{ gap: 12 }}>
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div className="itemTitle">Score discipline</div>
                        <div className="small2 textMuted">
                          {disciplineModel.window === "30d" ? "Fenêtre 30 jours" : "Fenêtre 7 jours"} · 100% = aucune occurrence manquée
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          ...(disciplineTone === "good"
                            ? STATUS_STYLES.ACTIVE
                            : disciplineTone === "warn"
                              ? STATUS_STYLES.EMPTY
                              : {
                                  backgroundColor: "rgba(244,67,54,0.14)",
                                  borderColor: "rgba(244,67,54,0.8)",
                                  color: "#FFECEC",
                                }),
                          borderWidth: 1,
                          borderStyle: "solid",
                        }}
                      >
                        {disciplineScore}%
                      </span>
                    </div>

                    <Meter value01={disciplineScore / 100} tone={disciplineTone} />

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <button
                          type="button"
                          className={disciplineWindow === "7d" ? "segBtn segBtnActive" : "segBtn"}
                          onClick={() => setDisciplineWindow("7d")}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: disciplineWindow === "7d" ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: 12,
                          }}
                        >
                          7j
                        </button>
                        <button
                          type="button"
                          className={disciplineWindow === "30d" ? "segBtn segBtnActive" : "segBtn"}
                          onClick={() => setDisciplineWindow("30d")}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 12,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: disciplineWindow === "30d" ? "rgba(124,58,237,0.22)" : "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.92)",
                            fontSize: 12,
                          }}
                        >
                          30j
                        </button>
                      </div>

                      <span
                        className="badge"
                        style={{ ...STATUS_STYLES.ACTIVE, borderWidth: 1, borderStyle: "solid" }}
                      >
                        Streak: {streak7d}j
                      </span>
                    </div>

                    <div className="col" style={{ gap: 10 }}>
                      <StatRow label="Occurrences attendues" value={String(disciplineModel.expected)} />
                      <StatRow label="Occurrences faites" value={String(disciplineModel.done)} />
                      <StatRow label="Occurrences manquées" value={String(disciplineModel.missed)} />
                      <StatRow label="Sessions annulées (7j)" value={String(disciplineSummary.cancelledSessions7d)} />
                      <StatRow label="Jours sans exécution (7j)" value={String(disciplineSummary.noExecutionDays7d)} />
                    </div>

                    <div style={{ paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="sectionTitle">Analyse</div>
                      <div className="mt10 col" style={{ gap: 10 }}>
                        {disciplineInsights.map((it, idx) => {
                          const tone = it.tone || "accent";
                          const style =
                            tone === "good"
                              ? STATUS_STYLES.ACTIVE
                              : tone === "warn"
                                ? STATUS_STYLES.EMPTY
                                : {
                                    backgroundColor: "rgba(244,67,54,0.14)",
                                    borderColor: "rgba(244,67,54,0.8)",
                                    color: "#FFECEC",
                                  };
                          return (
                            <div
                              key={`${it.title}-${idx}`}
                              className="row"
                              style={{
                                gap: 10,
                                alignItems: "flex-start",
                                padding: 10,
                                borderRadius: 14,
                                border: `1px solid ${style.borderColor}`,
                                background: style.backgroundColor,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div className="itemTitle" style={{ color: style.color }}>
                                  {it.title}
                                </div>
                                <div className="small2" style={{ opacity: 0.95 }}>
                                  {it.detail}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt12">
                        <div className="small2 textMuted">
                          Règle : ton score baisse uniquement quand une occurrence attendue n’est pas exécutée.
                        </div>
                      </div>
                    </div>

                    {showPlanningCta ? (
                      <div className="mt10">
                        <div className="small2 textMuted">
                          Aucune occurrence attendue. Crée une action (récurrente, ponctuelle, ou “sans heure”) pour rendre la discipline mesurable.
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          }

          return null;
        }}
      />
    </ScreenShell>
  );
}