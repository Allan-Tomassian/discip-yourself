import React, { useCallback, useEffect, useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import AccentItem from "../components/AccentItem";
import { todayKey } from "../utils/dates";
import {
  getCategoryCounts,
  getCategoryStatus,
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

export default function Pilotage({ data, setData, onPlanCategory }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const now = new Date();

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      map.set(c.id, getCategoryCounts(safeData, c.id));
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

  const selectedCategoryId = safeData?.ui?.selectedCategoryByView?.pilotage || categories?.[0]?.id || null;
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

  // Pilotage doit piloter sa sélection : on garde un id valide quand la liste change.
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
    // Tolérant : accepte plusieurs noms possibles
    return (
      c?.color ||
      c?.accentColor ||
      c?.hex ||
      c?.themeColor ||
      "#6EE7FF" // fallback cohérent avec l'UI actuelle
    );
  }, []);

  return (
    <ScreenShell
      headerTitle={<span className="textAccent" data-tour-id="pilotage-title">Pilotage</span>}
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
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (typeof onPlanCategory === "function") onPlanCategory(selectedCategoryId);
                      }}
                      disabled={!categories?.length}
                      aria-label="Planifier la catégorie"
                      title="Planifier"
                      data-tour-id="pilotage-planifier"
                    >
                      Planifier
                    </Button>
                  </div>
                  <div className="mt12 col" role="list" style={{ gap: 10 }}>
                    {categories.map((c) => {
                      const counts = countsByCategory.get(c.id) || { outcomesCount: 0, processCount: 0 };
                      const label = statusByCategory.get(c.id) || "ACTIVE";
                      const summary =
                        counts.outcomesCount || counts.processCount
                          ? `${counts.outcomesCount} objectifs \u00b7 ${counts.processCount} actions`
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
                              style={{
                                ...statusStyle,
                                borderWidth: 1,
                                borderStyle: "solid",
                              }}
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
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="itemTitle">Aujourd'hui</div>
                      <div className="itemSub">
                        {loadSummary.today.done}/{loadSummary.today.planned} terminées
                      </div>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="itemTitle">Cette semaine</div>
                      <div className="itemSub">
                        {loadSummary.week.done}/{loadSummary.week.planned} terminées
                      </div>
                    </div>
                    {loadSummary.emptyToday ? (
                      <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                        <div className="small2">Rien de planifié aujourd'hui.</div>
                        <div className="small2" aria-label="Utiliser le bouton Planifier en haut">
                          Planifier via le bouton en haut
                        </div>
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
                  <div className="mt12 col" style={{ gap: 10 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="itemTitle">Sessions annulées (7j)</div>
                      <div className="itemSub">{disciplineSummary.cancelledSessions7d}</div>
                    </div>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="itemTitle">Jours sans exécution (7j)</div>
                      <div className="itemSub">{disciplineSummary.noExecutionDays7d}</div>
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
