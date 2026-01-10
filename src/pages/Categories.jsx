// src/pages/Categories.jsx
import React, { useMemo } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, AccentItem } from "../components/UI";
import { isPrimaryCategory } from "../logic/priority";
import { getCategoryCounts } from "../logic/pilotage";

// TOUR MAP:
// - primary_action: open manage for selected category
// - key_elements: create button, category list, category cards
// - optional_elements: priority badge
function formatCount(count, singular, plural) {
  if (count === 0) return `0 ${plural}`;
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

export default function Categories({ data, setData, onOpenLibraryCategory, onOpenCreate }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];

  // IMPORTANT:
  // This page must not mutate ui.selectedCategoryId (used by Plan / CategoryDetail).
  // We isolate the Library selection using ui.librarySelectedCategoryId.
  const librarySelectedCategoryId = safeData?.ui?.librarySelectedCategoryId || null;
  const libraryViewSelectedId = safeData?.ui?.selectedCategoryByView?.library || librarySelectedCategoryId || null;

  function setLibraryCategory(categoryId, { navigate } = {}) {
    if (!categoryId) return;

    // Keep Library selection local to Library page only
    if (typeof setData === "function") {
      setData((prev) => {
        const prevUi = prev.ui || {};
        const prevSel =
          prevUi.selectedCategoryByView && typeof prevUi.selectedCategoryByView === "object"
            ? prevUi.selectedCategoryByView
            : {};
        return {
          ...prev,
          ui: {
            ...prevUi,
            librarySelectedCategoryId: categoryId,
            selectedCategoryByView: { ...prevSel, library: categoryId },
          },
        };
      });
    }

    if (navigate && typeof onOpenLibraryCategory === "function") {
      onOpenLibraryCategory(categoryId);
    }
  }

  function handleOpenManage() {
    const fallbackId = categories[0]?.id || null;
    const targetId = libraryViewSelectedId || fallbackId;
    if (!targetId) return;
    setLibraryCategory(targetId, { navigate: true });
  }

  if (categories.length === 0) {
    return (
      <ScreenShell
        headerTitle={<span className="textAccent" data-tour-id="library-title">Bibliothèque</span>}
        headerSubtitle="Aucune catégorie"
        backgroundImage={safeData?.profile?.whyImage || ""}
      >
        <div className="stack stackGap12" style={{ maxWidth: 720, margin: "0 auto" }}>
          <Card>
            <div className="p18">
              <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                <div className="sectionTitle">Catégories</div>
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="ghost"
                    onClick={handleOpenManage}
                    disabled={!categories.length}
                    data-tour-id="library-manage"
                  >
                    Gérer
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}
                    data-tour-id="library-create"
                  >
                    Créer
                  </Button>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="titleSm">Aucune catégorie</div>
                <div className="small" style={{ marginTop: 6 }}>
                  Ajoute une première catégorie pour commencer.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </ScreenShell>
    );
  }

  const sortedCategories = useMemo(() => {
    if (!librarySelectedCategoryId) return categories;
    const copy = categories.slice();
    copy.sort((a, b) => (a.id === librarySelectedCategoryId ? -1 : b.id === librarySelectedCategoryId ? 1 : 0));
    return copy;
  }, [categories, librarySelectedCategoryId]);

  const countsByCategory = useMemo(() => {
    const map = new Map();
    for (const c of categories) {
      const counts = getCategoryCounts(safeData, c.id);
      map.set(c.id, { habits: counts.processCount, objectives: counts.outcomesCount });
    }
    return map;
  }, [categories, safeData]);

  return (
    <ScreenShell
      headerTitle={<span className="textAccent" data-tour-id="library-title">Bibliothèque</span>}
      headerSubtitle="Catégories"
      backgroundImage={safeData?.profile?.whyImage || ""}
    >
      <div className="stack stackGap12" style={{ maxWidth: 720, margin: "0 auto" }}>
        <Card>
          <div className="p18">
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div className="sectionTitle">Catégories</div>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="ghost" onClick={handleOpenManage} data-tour-id="library-manage">
                  Gérer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => (typeof onOpenCreate === "function" ? onOpenCreate() : null)}
                  data-tour-id="library-create"
                >
                  Créer
                </Button>
              </div>
            </div>

            <div className="mt12 col" data-tour-id="library-category-list" style={{ gap: 10 }}>
              {sortedCategories.map((c) => {
                const counts = countsByCategory.get(c.id) || { habits: 0, objectives: 0 };
                const objectives = counts.objectives;
                const habits = counts.habits;
                const summary =
                  objectives || habits
                    ? `${formatCount(habits, "action", "actions")} · ${formatCount(objectives, "objectif", "objectifs")}`
                    : "Aucun élément";

                const isSelected = libraryViewSelectedId === c.id;

                return (
                  <AccentItem
                    key={c.id}
                    color={c.color}
                    selected={isSelected}
                    onClick={() => setLibraryCategory(c.id, { navigate: true })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setLibraryCategory(c.id, { navigate: true });
                      }
                    }}
                  >
                    <div>
                      <div className="itemTitle">
                        {c.name}
                        {isPrimaryCategory(c) ? (
                          <span
                            className="badge"
                            style={{ marginLeft: 8, borderColor: "var(--accent)", color: "var(--accent)" }}
                          >
                            Prioritaire
                          </span>
                        ) : null}
                      </div>
                      <div className="itemSub">{summary}</div>
                    </div>
                  </AccentItem>
                );
              })}
            </div>
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
