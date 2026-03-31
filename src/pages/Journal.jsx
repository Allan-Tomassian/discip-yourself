import React, { useEffect, useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { GateButton, GateSection, GateSectionIntro } from "../shared/ui/gate/Gate";
import { SURFACE_LABELS } from "../ui/labels";
import {
  CATEGORY_VIEW,
  getSelectedCategoryForView,
  getVisibleCategories,
  resolvePreferredVisibleCategoryId,
  withSelectedCategoryByView,
} from "../domain/categoryVisibility";
import { todayLocalKey } from "../utils/dateKey";

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function buildHistoryItems({ noteHistoryStorageKey, noteKeyPrefix, noteMetaKeyPrefix }) {
  const items = [];
  const history = parseJson(localStorage.getItem(noteHistoryStorageKey) || "", []);
  if (Array.isArray(history)) {
    history.forEach((entry, index) => {
      if (!entry || typeof entry !== "object") return;
      const note = typeof entry.note === "string" ? entry.note : "";
      const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
      if (!note.trim() && !meta.forme && !meta.humeur && !meta.motivation) return;
      items.push({
        id: `${entry.dateKey || "unknown"}:${entry.savedAt || index}`,
        dateKey: entry.dateKey || "",
        note,
        meta,
        savedAt: Number(entry.savedAt) || 0,
        kind: "archived",
      });
    });
  }

  Object.keys(localStorage)
    .filter((key) => key.startsWith(noteKeyPrefix))
    .forEach((key) => {
      const dateKey = key.slice(noteKeyPrefix.length);
      const note = localStorage.getItem(key) || "";
      const meta = parseJson(localStorage.getItem(`${noteMetaKeyPrefix}${dateKey}`) || "", {});
      if (!note.trim() && !meta.forme && !meta.humeur && !meta.motivation) return;
      items.push({
        id: `current:${dateKey}`,
        dateKey,
        note,
        meta,
        savedAt: 0,
        kind: "current",
      });
    });

  return items.sort((left, right) => {
    const leftTs = Number(left.savedAt) || 0;
    const rightTs = Number(right.savedAt) || 0;
    if (leftTs !== rightTs) return rightTs - leftTs;
    return String(right.dateKey || "").localeCompare(String(left.dateKey || ""));
  });
}

export default function Journal({ data, setData }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = useMemo(() => getVisibleCategories(safeData.categories), [safeData.categories]);
  const activeCategoryId = useMemo(
    () =>
      resolvePreferredVisibleCategoryId({
        categories,
        candidates: [
          getSelectedCategoryForView(safeData, CATEGORY_VIEW.TODAY),
          safeData?.ui?.selectedCategoryId,
        ],
      }),
    [categories, safeData]
  );
  const [categoryId, setCategoryId] = useState(activeCategoryId);
  const [note, setNote] = useState("");
  const [meta, setMeta] = useState({ forme: "", humeur: "", motivation: "" });
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    setCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  const todayKey = todayLocalKey();
  const noteKeyPrefix = categoryId ? `dailyNote:${categoryId}:` : "dailyNote:";
  const noteMetaKeyPrefix = categoryId ? `dailyNoteMeta:${categoryId}:` : "dailyNoteMeta:";
  const noteStorageKey = `${noteKeyPrefix}${todayKey}`;
  const noteMetaStorageKey = `${noteMetaKeyPrefix}${todayKey}`;
  const noteHistoryStorageKey = categoryId ? `dailyNoteHistory:${categoryId}` : "dailyNoteHistory";

  useEffect(() => {
    if (!categoryId || typeof setData !== "function") return;
    setData((prev) => ({
      ...prev,
      ui: withSelectedCategoryByView(prev?.ui, {
        today: categoryId,
        selectedCategoryId: categoryId,
      }),
    }));
  }, [categoryId, setData]);

  useEffect(() => {
    setNote(localStorage.getItem(noteStorageKey) || "");
    setMeta(parseJson(localStorage.getItem(noteMetaStorageKey) || "", { forme: "", humeur: "", motivation: "" }));
  }, [noteMetaStorageKey, noteStorageKey]);

  useEffect(() => {
    localStorage.setItem(noteStorageKey, note || "");
  }, [note, noteStorageKey]);

  useEffect(() => {
    localStorage.setItem(noteMetaStorageKey, JSON.stringify(meta));
  }, [meta, noteMetaStorageKey]);

  const historyItems = useMemo(() => {
    void historyVersion;
    return buildHistoryItems({ noteHistoryStorageKey, noteKeyPrefix, noteMetaKeyPrefix });
  }, [historyVersion, noteHistoryStorageKey, noteKeyPrefix, noteMetaKeyPrefix]);

  const archiveCurrentNote = () => {
    const trimmed = (note || "").trim();
    const hasMeta = Boolean(meta.forme || meta.humeur || meta.motivation);
    if (!trimmed && !hasMeta) return;
    const history = parseJson(localStorage.getItem(noteHistoryStorageKey) || "", []);
    const next = Array.isArray(history) ? history.slice() : [];
    next.unshift({
      dateKey: todayKey,
      note: trimmed,
      meta,
      savedAt: Date.now(),
    });
    localStorage.setItem(noteHistoryStorageKey, JSON.stringify(next));
    const clearedMeta = { forme: "", humeur: "", motivation: "" };
    setNote("");
    setMeta(clearedMeta);
    localStorage.setItem(noteStorageKey, "");
    localStorage.setItem(noteMetaStorageKey, JSON.stringify(clearedMeta));
    setHistoryVersion((value) => value + 1);
  };

  const clearCurrentNote = () => {
    const clearedMeta = { forme: "", humeur: "", motivation: "" };
    setNote("");
    setMeta(clearedMeta);
    localStorage.setItem(noteStorageKey, "");
    localStorage.setItem(noteMetaStorageKey, JSON.stringify(clearedMeta));
    setHistoryVersion((value) => value + 1);
  };

  const deleteHistoryItem = (itemId) => {
    if (!itemId) return;
    if (itemId.startsWith("current:")) {
      const dateKey = itemId.slice("current:".length);
      localStorage.setItem(`${noteKeyPrefix}${dateKey}`, "");
      localStorage.setItem(`${noteMetaKeyPrefix}${dateKey}`, JSON.stringify({ forme: "", humeur: "", motivation: "" }));
      if (dateKey === todayKey) {
        setNote("");
        setMeta({ forme: "", humeur: "", motivation: "" });
      }
      setHistoryVersion((value) => value + 1);
      return;
    }
    const history = parseJson(localStorage.getItem(noteHistoryStorageKey) || "", []);
    const next = Array.isArray(history) ? history.filter((entry, index) => {
      const key = `${entry?.dateKey || "unknown"}:${entry?.savedAt || index}`;
      return key !== itemId;
    }) : [];
    localStorage.setItem(noteHistoryStorageKey, JSON.stringify(next));
    setHistoryVersion((value) => value + 1);
  };

  return (
    <ScreenShell
      data={safeData}
      pageId="journal"
      backgroundImage={safeData?.profile?.whyImage || ""}
      headerTitle={SURFACE_LABELS.journal}
      headerSubtitle="Capture le contexte du jour sans repasser par Today."
    >
      <section className="mainPageSection">
        <GateSectionIntro title="Édition" subtitle="Écriture rapide, contexte et niveau d’énergie." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            <div className="GateInlineMetaCard col gap8">
              <label className="GateFormField">
                <span className="GateFormLabel">Catégorie</span>
                <select
                  className="GateSelectPremium"
                  value={categoryId || ""}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="GateFormField">
                <span className="GateFormLabel">Note</span>
                <textarea
                  className="GateTextareaPremium"
                  rows={5}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Écris une remarque, une idée ou un ressenti pour aujourd’hui…"
                />
              </label>
            </div>
            <div className="GateInlineMetaCard col gap8">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 12,
                }}
              >
                <label className="GateFormField">
                  <span className="GateFormLabel">Forme</span>
                  <select
                    className="GateSelectPremium"
                    value={meta.forme || ""}
                    onChange={(event) => setMeta((prev) => ({ ...prev, forme: event.target.value }))}
                  >
                    <option value="">Choisir</option>
                    <option value="Excellente">Excellente</option>
                    <option value="Bonne">Bonne</option>
                    <option value="Moyenne">Moyenne</option>
                    <option value="Faible">Faible</option>
                  </select>
                </label>
                <label className="GateFormField">
                  <span className="GateFormLabel">Humeur</span>
                  <select
                    className="GateSelectPremium"
                    value={meta.humeur || ""}
                    onChange={(event) => setMeta((prev) => ({ ...prev, humeur: event.target.value }))}
                  >
                    <option value="">Choisir</option>
                    <option value="Calme">Calme</option>
                    <option value="Motivé">Motivé</option>
                    <option value="Fatigué">Fatigué</option>
                    <option value="Tendu">Tendu</option>
                  </select>
                </label>
                <label className="GateFormField">
                  <span className="GateFormLabel">Motivation</span>
                  <input
                    className="GateInputPremium"
                    type="number"
                    min="0"
                    max="10"
                    value={meta.motivation || ""}
                    onChange={(event) => setMeta((prev) => ({ ...prev, motivation: event.target.value }))}
                    placeholder="0 à 10"
                  />
                </label>
              </div>
              <div className="GatePrimaryCtaRow">
                <GateButton type="button" className="GatePressable" withSound onClick={archiveCurrentNote}>
                  Archiver la note
                </GateButton>
                <GateButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="GatePressable"
                  withSound
                  onClick={clearCurrentNote}
                >
                  Vider
                </GateButton>
              </div>
            </div>
          </div>
        </GateSection>
      </section>

      <section className="mainPageSection">
        <GateSectionIntro title="Historique" subtitle="Notes archivées pour cette catégorie." />
        <GateSection collapsible={false} className="GateSurfacePremium GateCardPremium GateSecondarySectionCard">
          <div className="col gap12">
            {historyItems.length ? (
              historyItems.map((item) => {
                const metaParts = [];
                if (item.meta?.forme) metaParts.push(`Forme: ${item.meta.forme}`);
                if (item.meta?.humeur) metaParts.push(`Humeur: ${item.meta.humeur}`);
                if (item.meta?.motivation) metaParts.push(`Motivation: ${item.meta.motivation}`);
                return (
                  <div key={item.id} className="GateInlineMetaCard col gap8">
                    <div className="row rowBetween gap12 wrap">
                      <div className="GateRoleCardMeta">{item.dateKey || todayKey}</div>
                      <GateButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="GatePressable"
                        withSound
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        Supprimer
                      </GateButton>
                    </div>
                    {metaParts.length ? <div className="GateRoleCardMeta">{metaParts.join(" · ")}</div> : null}
                    {item.note ? <div className="GateRoleHelperText">{item.note}</div> : null}
                  </div>
                );
              })
            ) : (
              <div className="GateInlineMetaCard col gap8">
                <div className="GateRoleHelperText">Aucune note enregistrée pour cette catégorie.</div>
              </div>
            )}
          </div>
        </GateSection>
      </section>
    </ScreenShell>
  );
}
