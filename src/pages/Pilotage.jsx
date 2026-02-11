import React, { useCallback, useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Input } from "../components/UI";
import Select from "../ui/select/Select";
import AccentItem from "../components/AccentItem";
import { getCategoryPilotageCounts, getCategoryStatus } from "../logic/pilotage";
import {
  computeDailyStats,
  computeStats,
  getWindowBounds,
  selectOccurrencesInRange,
} from "../logic/metrics";
import { buildReport, exportReportToCSV } from "../logic/reporting";
import SortableBlocks from "../components/SortableBlocks";
import { getDefaultBlockIds } from "../logic/blocks/registry";
import { LABELS } from "../ui/labels";
import { computeCategoryRadarRows, computePilotageInsights } from "../features/pilotage/radarModel";
import { sanitizePilotageRadarSelection } from "../logic/state/normalizers";
import "../features/pilotage/pilotage.css";

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
  "pilotage.reporting": { id: "pilotage.reporting" },
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

const normalizeRadarSelection = (selection, availableIds, fallbackIds) => {
  const available = Array.isArray(availableIds) ? availableIds.filter(Boolean) : [];
  if (!available.length) return [];
  const allowed = new Set(available);
  const out = [];
  const pushIfValid = (id) => {
    if (typeof id !== "string" || !allowed.has(id)) return;
    if (out.includes(id)) return;
    out.push(id);
  };
  (Array.isArray(selection) ? selection : []).forEach(pushIfValid);
  (Array.isArray(fallbackIds) ? fallbackIds : []).forEach(pushIfValid);
  available.forEach(pushIfValid);
  return out.slice(0, Math.min(3, available.length));
};

const PILOTAGE_RADAR_STORAGE_KEY = "pilotageRadarSelection";

const loadRadarSelectionFromStorage = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PILOTAGE_RADAR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch (err) {
    void err;
    return [];
  }
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
  const goals = useMemo(() => (Array.isArray(safeData.goals) ? safeData.goals : []), [safeData.goals]);

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

  const weekBounds = useMemo(() => getWindowBounds("7d", now), [now]);
  const twoWeekBounds = useMemo(() => getWindowBounds("14d", now), [now]);

  const weekDailyStats = useMemo(
    () => computeDailyStats(safeData, weekBounds.fromKey, weekBounds.toKey),
    [safeData, weekBounds.fromKey, weekBounds.toKey]
  );

  const stats14d = useMemo(() => {
    const list = selectOccurrencesInRange(safeData, twoWeekBounds.fromKey, twoWeekBounds.toKey);
    return computeStats(list);
  }, [safeData, twoWeekBounds.fromKey, twoWeekBounds.toKey]);


  const selectedCategoryId =
    safeData?.ui?.selectedCategoryByView?.pilotage || categories?.[0]?.id || null;

  const [reportWindow, setReportWindow] = useState("7d");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportCategoryId, setReportCategoryId] = useState("");
  const [reportGoalId, setReportGoalId] = useState("");

  useEffect(() => {
    if (reportWindow === "custom") return;
    const bounds = getWindowBounds(reportWindow, now);
    setReportFrom(bounds.fromKey);
    setReportTo(bounds.toKey);
  }, [reportWindow, now]);

  const weekPct = useMemo(
    () => pct(weekDailyStats.totals?.done, weekDailyStats.totals?.expected),
    [weekDailyStats.totals]
  );
  const twoWeekPct = useMemo(
    () => pct(stats14d?.done, stats14d?.expected),
    [stats14d]
  );

  const weekExpected = Number(weekDailyStats.totals?.expected) || 0;
  const weekDone = Number(weekDailyStats.totals?.done) || 0;

  const trendDelta = useMemo(() => {
    if (weekPct == null || twoWeekPct == null) return null;
    return Math.round(weekPct - twoWeekPct);
  }, [weekPct, twoWeekPct]);

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
    const list = selectOccurrencesInRange(safeData, weekBounds.fromKey, weekBounds.toKey, {
      categoryId: selectedCategoryId,
    });
    return computeStats(list);
  }, [safeData, selectedCategoryId, weekBounds.fromKey, weekBounds.toKey]);

  const radarWindow = twoWeekBounds;

  const categoryRadarRows = useMemo(() => {
    return computeCategoryRadarRows(safeData, radarWindow.fromKey, radarWindow.toKey);
  }, [radarWindow.fromKey, radarWindow.toKey, safeData]);

  const availableRadarIds = useMemo(
    () => categoryRadarRows.map((row) => row.categoryId).filter(Boolean),
    [categoryRadarRows]
  );
  const sanitizeRadarSelection = useCallback(
    (selection) =>
      sanitizePilotageRadarSelection(
        { categories, ui: { pilotageRadarSelection: selection } },
        { selection }
      ),
    [categories]
  );
  const defaultRadarSelection = useMemo(() => {
    const seed = categoryRadarRows.slice(0, 3).map((row) => row.categoryId);
    return normalizeRadarSelection(seed, availableRadarIds, availableRadarIds);
  }, [availableRadarIds, categoryRadarRows]);
  const uiRadarSelection = useMemo(() => {
    return sanitizeRadarSelection(safeData?.ui?.pilotageRadarSelection);
  }, [safeData?.ui?.pilotageRadarSelection, sanitizeRadarSelection]);
  const persistedRadarSelection = useMemo(() => {
    const source = uiRadarSelection.length ? uiRadarSelection : loadRadarSelectionFromStorage();
    return sanitizeRadarSelection(source);
  }, [sanitizeRadarSelection, uiRadarSelection]);
  const persistedNormalizedRadarSelection = useMemo(
    () =>
      normalizeRadarSelection(
        persistedRadarSelection.length ? persistedRadarSelection : defaultRadarSelection,
        availableRadarIds,
        defaultRadarSelection
      ),
    [availableRadarIds, defaultRadarSelection, persistedRadarSelection]
  );
  const [radarSelection, setRadarSelection] = useState(persistedNormalizedRadarSelection);

  useEffect(() => {
    setRadarSelection((prev) => {
      const normalizedPrev = sanitizeRadarSelection(
        normalizeRadarSelection(prev, availableRadarIds, defaultRadarSelection)
      );
      return arrayEqual(prev, normalizedPrev) ? prev : normalizedPrev;
    });
  }, [availableRadarIds, defaultRadarSelection, sanitizeRadarSelection]);

  useEffect(() => {
    if (typeof setData !== "function") return;
    const normalized = sanitizeRadarSelection(
      normalizeRadarSelection(radarSelection, availableRadarIds, defaultRadarSelection)
    );
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(PILOTAGE_RADAR_STORAGE_KEY, JSON.stringify(normalized));
      } catch (err) {
        void err;
      }
    }
    const normalizedUiRadarSelection = sanitizeRadarSelection(
      normalizeRadarSelection(
        uiRadarSelection.length ? uiRadarSelection : defaultRadarSelection,
        availableRadarIds,
        defaultRadarSelection
      )
    );
    if (arrayEqual(normalized, normalizedUiRadarSelection)) return;
    setData((prev) => {
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const prevSelection = Array.isArray(prevUi.pilotageRadarSelection)
        ? prevUi.pilotageRadarSelection
        : [];
      if (arrayEqual(prevSelection, normalized)) return prev;
      return {
        ...prev,
        ui: {
          ...prevUi,
          pilotageRadarSelection: normalized,
        },
      };
    });
  }, [
    availableRadarIds,
    defaultRadarSelection,
    radarSelection,
    sanitizeRadarSelection,
    setData,
    uiRadarSelection,
  ]);

  const safeRadarSelection = useMemo(
    () => sanitizeRadarSelection(radarSelection),
    [radarSelection, sanitizeRadarSelection]
  );

  const radarVisibleRows = useMemo(() => {
    const selected = safeRadarSelection.filter(Boolean);
    const rows = selected
      .map((id) => categoryRadarRows.find((row) => row.categoryId === id))
      .filter(Boolean);
    return rows.slice(0, 3);
  }, [categoryRadarRows, safeRadarSelection]);

  const handleRadarSelect = useCallback(
    (slotIndex, nextId) => {
      if (!availableRadarIds.includes(nextId)) return;
      setRadarSelection((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        const existingIndex = next.findIndex((id) => id === nextId);
        if (existingIndex >= 0 && existingIndex !== slotIndex) {
          next[existingIndex] = next[slotIndex];
        }
        next[slotIndex] = nextId;
        return sanitizeRadarSelection(
          normalizeRadarSelection(next, availableRadarIds, defaultRadarSelection)
        );
      });
    },
    [availableRadarIds, defaultRadarSelection, sanitizeRadarSelection]
  );

  const insights = useMemo(() => {
    return computePilotageInsights(safeData, radarWindow.fromKey, radarWindow.toKey);
  }, [radarWindow.fromKey, radarWindow.toKey, safeData]);

  const reportGoals = useMemo(() => {
    const list = goals.filter((g) => g && typeof g.id === "string");
    if (!reportCategoryId) return list;
    return list.filter((g) => g.categoryId === reportCategoryId);
  }, [goals, reportCategoryId]);

  useEffect(() => {
    if (!reportGoalId) return;
    const exists = reportGoals.some((g) => g.id === reportGoalId);
    if (exists) return;
    setReportGoalId("");
  }, [reportGoalId, reportGoals]);

  const reportPreview = useMemo(() => {
    if (!reportFrom || !reportTo) return null;
    const goalIds = reportGoalId ? [reportGoalId] : null;
    const categoryId = reportCategoryId || null;
    return buildReport(safeData, { fromKey: reportFrom, toKey: reportTo, categoryId, goalIds });
  }, [safeData, reportFrom, reportTo, reportCategoryId, reportGoalId]);

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

  const downloadFile = useCallback((filename, content, type) => {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      void err;
    }
  }, []);

  const handleExportReport = useCallback(() => {
    if (!reportPreview) return;
    const meta = reportPreview.meta || {};
    const from = meta.fromKey || reportFrom || "report";
    const to = meta.toKey || reportTo || "report";
    const base = `report-${from}-${to}`;
    const payload = JSON.stringify(reportPreview, null, 2);
    const { dailyCsv, goalsCsv } = exportReportToCSV(reportPreview);
    downloadFile(`${base}.json`, payload, "application/json");
    downloadFile(`${base}-daily.csv`, dailyCsv, "text/csv");
    downloadFile(`${base}-goals.csv`, goalsCsv, "text/csv");
  }, [downloadFile, reportPreview, reportFrom, reportTo]);

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
                          ? `${counts.activeOutcomesCount} ${LABELS.goalsLower} · ${counts.processCount} ${LABELS.actionsLower}`
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
                              ? `${selectedCounts.activeOutcomesCount || 0} ${LABELS.goalsLower} · ${selectedCounts.processCount || 0} ${LABELS.actionsLower}`
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
                          Conseil : vise 1 {LABELS.goalLower} actif + 1 à 3 actions récurrentes. Le reste = bruit.
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
              <div className="pilotageTopGrid" data-tour-id="pilotage-load">
                <Card>
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
                    <div className="pilotageMetricMain">
                      <div className="pilotageMetricValue">
                        {weekDone}/{weekExpected}
                      </div>
                      <div className="small2 textMuted">fait / attendu (7j)</div>
                    </div>
                    <Meter
                      value01={weekPct == null ? 0 : weekPct / 100}
                      tone={weekPct == null ? "accent" : weekPct >= 95 ? "good" : weekPct >= 80 ? "warn" : "bad"}
                    />
                  </div>
                </Card>

                <Card>
                  <div className="p18">
                    <div className="sectionTitle">Tendance</div>
                    <div className="pilotageMetricMain">
                      <div
                        className={`pilotageTrendValue ${trendDelta != null && trendDelta >= 0 ? "is-up" : "is-down"}`}
                      >
                        {trendDelta == null ? "—" : `${trendDelta >= 0 ? "+" : ""}${trendDelta} pts`}
                      </div>
                      <div className="small2 textMuted">7j vs 14j</div>
                    </div>
                    <div className="small2 textMuted">
                      {weekPct == null ? "7j : —" : `7j : ${weekPct}%`} ·{" "}
                      {twoWeekPct == null ? "14j : —" : `14j : ${twoWeekPct}%`}
                    </div>
                  </div>
                </Card>
              </div>
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
                    <div className="sectionTitle">Radar & insights</div>
                  </div>

                  <div className="pilotageRadarGrid">
                    <div className="pilotageRadarPanel">
                      <div className="pilotageRadarSvg">
                        {radarVisibleRows.length ? (
                          <svg viewBox="0 0 240 240" role="img" aria-label="Radar discipline">
                            <circle cx="120" cy="120" r="96" className="pilotageRadarGridLine" />
                            <circle cx="120" cy="120" r="64" className="pilotageRadarGridLine" />
                            <circle cx="120" cy="120" r="32" className="pilotageRadarGridLine" />
                            {["Discipline", "Régularité", "Charge", "Focus"].map((label, idx) => {
                              const angle = (Math.PI * 2 * idx) / 4 - Math.PI / 2;
                              const x = 120 + Math.cos(angle) * 110;
                              const y = 120 + Math.sin(angle) * 110;
                              return (
                                <g key={label}>
                                  <line
                                    x1="120"
                                    y1="120"
                                    x2={x}
                                    y2={y}
                                    className="pilotageRadarAxis"
                                  />
                                  <text x={x} y={y} className="pilotageRadarLabel">
                                    {label}
                                  </text>
                                </g>
                              );
                            })}
                            {radarVisibleRows.map((row) => {
                              const points = row.values
                                .map((axis, idx) => {
                                  const angle = (Math.PI * 2 * idx) / 4 - Math.PI / 2;
                                  const r = 96 * clamp01(axis.value || 0);
                                  const x = 120 + Math.cos(angle) * r;
                                  const y = 120 + Math.sin(angle) * r;
                                  return `${x},${y}`;
                                })
                                .join(" ");
                              return (
                                <polygon
                                  key={row.categoryId}
                                  points={points}
                                  fill={row.color}
                                  fillOpacity="0.18"
                                  stroke={row.color}
                                  strokeWidth="2"
                                />
                              );
                            })}
                          </svg>
                        ) : (
                          <div className="small2 textMuted">Aucune donnée récente.</div>
                        )}
                      </div>
                      <div className="pilotageRadarLegend">
                        {radarVisibleRows.map((row) => (
                          <div key={row.categoryId} className="pilotageLegendRow">
                            <span className="pilotageLegendDot" style={{ background: row.color }} />
                            <span className="small2">{row.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pilotageRadarPanel">
                      <div className="sectionTitle">Catégories visibles</div>
                      <div className="pilotageRadarSelects">
                        {radarSelection.slice(0, 3).map((id, idx) => (
                          <Select
                            key={`radar-slot-${idx}`}
                            value={id || ""}
                            onChange={(e) => handleRadarSelect(idx, e.target.value)}
                          >
                            {categoryRadarRows.map((row) => (
                              <option key={row.categoryId} value={row.categoryId}>
                                {row.label}
                              </option>
                            ))}
                          </Select>
                        ))}
                      </div>
                      <div className="small2 textMuted">
                        Règles: Discipline=fait/attendu (14j), Régularité=jours actifs/14,
                        Charge=attendu/jour (cap 3), Focus=part de l’action n°1.
                      </div>
                    </div>
                  </div>

                  <div className="pilotageInsights">
                    <div className="sectionTitle">Insights</div>
                    <div className="pilotageInsightItem">{insights.topCategory}</div>
                    <div className="pilotageInsightItem">{insights.missedAction}</div>
                    <div className="pilotageInsightItem">{insights.bestSlot}</div>
                  </div>

                  <details className="pilotageDetails">
                    <summary>Détails</summary>
                    <div className="pilotageDetailsBody">
                      <StatRow label="7j · attendues" value={String(weekDailyStats.totals?.expected || 0)} />
                      <StatRow label="7j · faites" value={String(weekDailyStats.totals?.done || 0)} />
                      <StatRow label="7j · manquées" value={String(weekDailyStats.totals?.missed || 0)} />
                      <StatRow label="14j · attendues" value={String(stats14d?.expected || 0)} />
                      <StatRow label="14j · faites" value={String(stats14d?.done || 0)} />
                      <StatRow label="14j · manquées" value={String(stats14d?.missed || 0)} />
                      <StatRow label="14j · annulées" value={String(stats14d?.canceled || 0)} />
                    </div>
                  </details>
                </div>
              </Card>
            );
          }

          if (blockId === "pilotage.reporting") {
            const totals = reportPreview?.totals || null;
            return (
              <Card data-tour-id="pilotage-reporting">
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
                    <div className="sectionTitle">Reporting</div>
                  </div>

                  <div className="mt12 col" style={{ gap: 12 }}>
                    <div className="col" style={{ gap: 6 }}>
                      <div className="small2 textMuted">Période</div>
                      <Select value={reportWindow} onChange={(e) => setReportWindow(e.target.value)}>
                        <option value="7d">7 jours</option>
                        <option value="14d">14 jours</option>
                        <option value="90d">90 jours</option>
                        <option value="custom">Personnalisée</option>
                      </Select>
                    </div>

                    {reportWindow === "custom" ? (
                      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <div className="col" style={{ gap: 6 }}>
                          <div className="small2 textMuted">Du</div>
                          <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
                        </div>
                        <div className="col" style={{ gap: 6 }}>
                          <div className="small2 textMuted">Au</div>
                          <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
                        </div>
                      </div>
                    ) : null}

                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                      <div className="col" style={{ gap: 6, minWidth: 180 }}>
                        <div className="small2 textMuted">Catégorie</div>
                        <Select value={reportCategoryId} onChange={(e) => setReportCategoryId(e.target.value)}>
                          <option value="">Toutes</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || "Catégorie"}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="col" style={{ gap: 6, minWidth: 200 }}>
                        <div className="small2 textMuted">Action</div>
                        <Select value={reportGoalId} onChange={(e) => setReportGoalId(e.target.value)}>
                          <option value="">Toutes</option>
                          {reportGoals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title || "Action"}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="col" style={{ gap: 8 }}>
                      <StatRow label="Occurrences attendues" value={String(totals?.expected || 0)} />
                      <StatRow label="Occurrences faites" value={String(totals?.done || 0)} />
                      <StatRow label="Occurrences manquées" value={String(totals?.missed || 0)} />
                      <StatRow label="Occurrences annulées" value={String(totals?.canceled || 0)} />
                      <StatRow label="Occurrences planifiées" value={String(totals?.planned || 0)} />
                    </div>

                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div className="small2 textMuted">
                        Exporte JSON + CSV (par jour et par action).
                      </div>
                      <Button onClick={handleExportReport} disabled={!reportPreview}>
                        Exporter
                      </Button>
                    </div>
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
