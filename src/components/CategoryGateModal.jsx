import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Modal } from "./UI";
import { SYSTEM_INBOX_ID } from "../logic/state";
import { SUGGESTED_CATEGORIES } from "../utils/categoriesSuggested";
import "./categoryGate.css";

function normalizeList(categories) {
  const list = Array.isArray(categories) ? categories.filter(Boolean) : [];
  const activeMap = new Map(list.map((c) => [c.id, c]));
  const sys = list.find((c) => c.id === SYSTEM_INBOX_ID) || null;
  const rest = list.filter((c) => c.id !== SYSTEM_INBOX_ID);
  rest.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "fr", { sensitivity: "base" }));
  const active = (sys ? [sys, ...rest] : rest).map((c) => ({ ...c, isActive: true }));
  const inactiveSuggestions = SUGGESTED_CATEGORIES.filter((c) => c && !activeMap.has(c.id)).map((c) => ({
    ...c,
    isActive: false,
    suggested: true,
  }));
  inactiveSuggestions.sort((a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), "fr", { sensitivity: "base" })
  );
  return active.concat(inactiveSuggestions);
}

export default function CategoryGateModal({
  open,
  categories,
  activeCategoryId,
  onClose,
  onConfirm,
  onCreateCategory,
  onToggleActive,
}) {
  const list = useMemo(() => normalizeList(categories), [categories]);
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#F97316");
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
    const isValid = activeCategoryId && list.some((c) => c.id === activeCategoryId);
    const fallback = list.find((c) => c.id !== SYSTEM_INBOX_ID) || list[0] || null;
    setSelectedId(isValid ? activeCategoryId : fallback?.id || null);
    setExpanded(!isMobile);
  }, [open, activeCategoryId, list]);

  useEffect(() => {
    if (!open) return;
    setExpanded(!isMobile);
  }, [open, isMobile]);

  const activeIds = useMemo(() => new Set(list.filter((c) => c.isActive).map((c) => c.id)), [list]);
  const canContinue = Boolean(selectedId && activeIds.size > 0 && activeIds.has(selectedId));

  const maxCollapsed = 3;
  const visibleList = expanded ? list : list.slice(0, maxCollapsed);
  const canToggleExpand = list.length > maxCollapsed;

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="categoryGateModal card"
      backdropClassName="categoryGateBackdrop"
    >
      <div className="categoryGateShell">
        <div className="categoryGateScroll">
          <div className="categoryGateHeader">
            <div className="cardSectionTitle">Catégorie</div>
            <div className="titleSm">Active une catégorie pour continuer</div>
          </div>

          <div
            className={`categoryGateList${expanded ? " isExpanded" : " isCollapsed"}`}
            role="listbox"
            aria-label="Catégories"
          >
            {visibleList.map((cat) => {
              const isSelected = cat.id === selectedId;
              const isActive = Boolean(cat.isActive);
              const isSystem = cat.id === SYSTEM_INBOX_ID;
              return (
                <div
                  key={cat.id}
                  className={`categoryGateItem${isSelected ? " isSelected" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
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
                    {isSystem ? <span className="categoryGateHint">(Général)</span> : null}
                  </span>
                  <button
                    type="button"
                    className={`categoryGateToggle${isActive ? " isActive" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isSystem) return;
                      if (typeof onToggleActive === "function") onToggleActive(cat, !isActive);
                    }}
                    disabled={isSystem}
                    aria-pressed={isActive}
                  >
                    {isActive ? "Actif" : "Inactif"}
                  </button>
                </div>
              );
            })}
          </div>

          {canToggleExpand ? (
            <div className="categoryGateExpand">
              <Button variant="ghost" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? "Réduire" : `Afficher toutes (${list.length})`}
              </Button>
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
              <Button variant="ghost" onClick={handleCreate}>
                Ajouter
              </Button>
            </div>
          </div>
        </div>

        <div className="categoryGateFooter">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button disabled={!canContinue} onClick={() => onConfirm(selectedId)}>
            Continuer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
