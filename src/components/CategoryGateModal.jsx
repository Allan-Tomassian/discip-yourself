import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Input, Modal } from "./UI";
import { SYSTEM_INBOX_ID } from "../logic/state";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import { GateButton, GateHeader, GatePanel } from "../shared/ui/gate/Gate";
import "../features/library/library.css";

export default function CategoryGateModal({
  open,
  categories,
  categoryRailOrder,
  activeCategoryId,
  goals = [],
  habits = [],
  onClose,
  onConfirm,
  onCreateCategory,
  onToggleActive,
}) {
  const categoryList = useMemo(
    () => (Array.isArray(categories) ? categories.filter(Boolean) : []),
    [categories]
  );
  const activeIds = useMemo(() => new Set(categoryList.map((c) => c.id).filter(Boolean)), [categoryList]);
  const activeRows = useMemo(() => {
    const ids = categoryList.map((c) => c.id);
    const baseOrder = Array.isArray(categoryRailOrder)
      ? categoryRailOrder.filter((id) => ids.includes(id))
      : [];
    const missing = ids.filter((id) => !baseOrder.includes(id));
    const orderedIds = [...baseOrder, ...missing];
    const map = new Map(categoryList.map((c) => [c.id, c]));
    return orderedIds.map((id) => map.get(id)).filter(Boolean).map((c) => ({ ...c, __kind: "active" }));
  }, [categoryList, categoryRailOrder]);
  const suggestionRows = useMemo(() => {
    const inactive = SUGGESTED_CATEGORIES.filter((c) => c && !activeIds.has(c.id)).map((c) => ({
      ...c,
      __kind: "suggestion",
    }));
    inactive.sort((a, b) =>
      String(a?.name || "").localeCompare(String(b?.name || ""), "fr", { sensitivity: "base" })
    );
    return inactive;
  }, [activeIds]);
  const rows = useMemo(() => [...activeRows, ...suggestionRows], [activeRows, suggestionRows]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#F97316");
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCat, setConfirmCat] = useState(null);
  const [confirmCounts, setConfirmCounts] = useState({ goalsCount: 0, habitsCount: 0, total: 0 });
  const isDev = Boolean(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV);

  const logDebug = useCallback(
    (msg) => {
      if (!isDev) return;
      if (typeof console !== "undefined" && typeof console.debug === "function") {
        console.debug("[CategoryGateModal]", msg);
      }
    },
    [isDev]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 720px)");
    const update = () => setIsMobile(Boolean(mq.matches));
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const isValid = activeCategoryId && activeIds.has(activeCategoryId);
    const fallback =
      activeRows.find((c) => c.id !== SYSTEM_INBOX_ID) ||
      activeRows[0] ||
      suggestionRows[0] ||
      null;
    setSelectedId(isValid ? activeCategoryId : fallback?.id || null);
    setExpanded(!isMobile);
  }, [open, activeCategoryId, activeIds, activeRows, suggestionRows, isMobile]);

  useEffect(() => {
    if (!open) return;
    setExpanded(!isMobile);
  }, [open, isMobile]);

  const canContinue = Boolean(selectedId && activeIds.size > 0 && activeIds.has(selectedId));

  const maxCollapsed = 3;
  const visibleList = expanded ? rows : rows.slice(0, maxCollapsed);
  const canToggleExpand = rows.length > maxCollapsed;

  const handleCreate = () => {
    if (typeof onCreateCategory !== "function") return;
    const name = newName.trim();
    if (!name) return;
    const createdId = onCreateCategory({ name, color: newColor });
    if (createdId) {
      setSelectedId(createdId);
      setNewName("");
    }
  };

  const countsByCategory = useMemo(() => {
    const map = new Map();
    const goalList = Array.isArray(goals) ? goals : [];
    const habitList = Array.isArray(habits) ? habits : [];
    for (const c of categoryList) {
      const goalsCount = goalList.filter((g) => g && g.categoryId === c.id).length;
      const habitsCount = habitList.filter((h) => h && h.categoryId === c.id).length;
      map.set(c.id, { goalsCount, habitsCount, total: goalsCount + habitsCount });
    }
    return map;
  }, [categoryList, goals, habits]);

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmCat(null);
    setConfirmCounts({ goalsCount: 0, habitsCount: 0, total: 0 });
  };

  const rowSummary = useMemo(
    () =>
      rows
        .map((row) => {
          const kind = row.__kind || (activeIds.has(row.id) ? "active" : "suggestion");
          const activeFlag = activeIds.has(row.id) ? "A" : "I";
          return `${row.id}:${kind}:${activeFlag}`;
        })
        .join(" | "),
    [rows, activeIds]
  );

  useEffect(() => {
    if (!isDev || !open) return;
    logDebug(`rows ${rowSummary || "∅"}`);
  }, [isDev, open, rowSummary, logDebug]);

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      className="categoryGateModal card"
      backdropClassName="categoryGateBackdrop"
    >
      <GatePanel className="categoryGateShell" data-testid="category-gate-modal">
        <div className="categoryGateScroll">
          <GateHeader className="categoryGateHeader" title="Catégorie" subtitle="Active une catégorie pour continuer" />

          <div
            className={`categoryGateList${expanded ? " isExpanded" : " isCollapsed"}`}
            role="listbox"
            aria-label="Catégories"
          >
            {visibleList.map((cat) => {
              const isSelected = cat.id === selectedId;
              const isActive = categoryList.some((c) => c?.id === cat.id);
              const isSystem = cat.id === SYSTEM_INBOX_ID;
              const counts = countsByCategory.get(cat.id) || { goalsCount: 0, habitsCount: 0, total: 0 };
              const fallbackCount =
                Number(cat?.goalsCount || cat?.habitsCount || cat?.itemsCount || cat?.contentCount || 0) || 0;
              const hasContent = counts.total > 0 || fallbackCount > 0;
              const rowKind = cat?.__kind || (isActive ? "active" : "suggestion");
              return (
                <div
                  key={cat.id}
                  className={`categoryGateItem${isSelected ? " isSelected" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  data-testid={`category-row-${cat.id}`}
                  onClick={() => setSelectedId(cat.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(cat.id);
                    }
                  }}
                >
                  <span className="categoryGateSwatch" style={{ background: cat.color || "#F97316" }} />
                  <span className="categoryGateName">
                    {cat.name || "Catégorie"}
                    {isSystem ? <span className="categoryGateHint">(Général · indispensable)</span> : null}
                  </span>
                  <button
                    type="button"
                    className={`categoryGateSwitch${isActive ? " isActive" : ""}${!isActive && isSelected ? " isAttention" : ""}`}
                    data-testid={`category-toggle-${cat.id}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      logDebug(
                        `toggle id=${cat?.id} kind=${rowKind} isActive=${isActive} next=${!isActive}`
                      );
                      if (isSystem) return;
                      if (isActive && hasContent) {
                        setConfirmCat(cat);
                        setConfirmCounts(counts);
                        setConfirmOpen(true);
                        logDebug(`confirm-open id=${cat?.id} counts=${counts.goalsCount}/${counts.habitsCount}`);
                        return;
                      }
                      if (typeof onToggleActive === "function") {
                        if (isActive) {
                          onToggleActive({ id: cat.id }, false, isDev ? { __debugSink: logDebug } : undefined);
                        } else {
                          onToggleActive(
                            { id: cat.id, name: cat.name, color: cat.color },
                            true,
                            isDev ? { __debugSink: logDebug } : undefined
                          );
                        }
                      }
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    disabled={isSystem}
                    aria-pressed={isActive}
                    title={isSystem ? "Catégorie indispensable." : "Active pour l’utiliser et créer du contenu."}
                  >
                    <span className="categoryGateSwitchLabel">{isActive ? "Activée" : "Activer"}</span>
                    <span className="categoryGateSwitchThumb" aria-hidden="true">
                      {isActive ? "✓" : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="categoryGateHelper small2 textMuted">
            Active pour l’utiliser et créer du contenu.
          </div>

          {canToggleExpand ? (
            <div className="categoryGateExpand">
              <GateButton variant="ghost" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? "Réduire" : `Afficher toutes (${rows.length})`}
              </GateButton>
            </div>
          ) : null}

          <div className="categoryGateCreate">
            <div className="titleSm">Créer une catégorie</div>
            <div className="categoryGateCreateRow">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la catégorie"
                aria-label="Nom de la catégorie"
              />
              <input
                type="color"
                className="categoryGateColor"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                aria-label="Couleur"
              />
              <GateButton variant="ghost" onClick={handleCreate}>
                Ajouter
              </GateButton>
            </div>
          </div>
        </div>

        <div className="categoryGateFooter">
          <GateButton variant="ghost" onClick={onClose}>
            Annuler
          </GateButton>
          <GateButton disabled={!canContinue} onClick={() => onConfirm(selectedId)} data-testid="category-gate-continue">
            Continuer
          </GateButton>
        </div>
      </GatePanel>
    </Modal>
    <Modal
      open={confirmOpen}
      onClose={closeConfirm}
      className="categoryGateModal card"
      backdropClassName="categoryGateBackdrop"
    >
      <GatePanel className="categoryGateShell" data-testid="category-gate-confirm">
        <div className="categoryGateScroll">
          <GateHeader
            className="categoryGateHeader"
            title={`Désactiver “${confirmCat?.name || "Catégorie"}” ?`}
            subtitle={`Cette catégorie contient ${confirmCounts.goalsCount} projet(s) et ${confirmCounts.habitsCount} action(s).`}
          />
          <div className="categoryGateHelper small2 textAccent">
            Si tu supprimes, tout sera perdu (irréversible).
          </div>
        </div>
        <div className="categoryGateFooter">
          <GateButton variant="ghost" onClick={closeConfirm}>
            Annuler
          </GateButton>
          <GateButton
            variant="ghost"
            data-testid="category-confirm-migrate"
            onClick={() => {
              if (!confirmCat) return;
              logDebug(`confirm mode=migrate id=${confirmCat?.id}`);
              if (typeof onToggleActive === "function") {
                onToggleActive(
                  confirmCat,
                  false,
                  isDev ? { mode: "migrate", __debugSink: logDebug } : { mode: "migrate" }
                );
              }
              closeConfirm();
            }}
          >
            Migrer vers Général
          </GateButton>
          <GateButton
            data-testid="category-confirm-delete"
            onClick={() => {
              if (!confirmCat) return;
              logDebug(`confirm mode=delete id=${confirmCat?.id}`);
              if (typeof onToggleActive === "function") {
                onToggleActive(
                  confirmCat,
                  false,
                  isDev ? { mode: "delete", __debugSink: logDebug } : { mode: "delete" }
                );
              }
              closeConfirm();
            }}
          >
            Supprimer contenu
          </GateButton>
        </div>
      </GatePanel>
    </Modal>
    </>
  );
}
