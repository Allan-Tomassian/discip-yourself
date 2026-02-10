import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { Button, Card } from "../../components/UI";
import { getMicroActionsForToday } from "../../core/microActions/microActionsEngine";
import { MICRO_ACTIONS_LIBRARY } from "../../core/microActions/microActionsLibrary";
import "../../features/today/today.css";

const SEEN_KEY = "microActionsSeen";
const DONE_KEY = "microActionsDone";
const SEEN_WINDOW_MS = 24 * 60 * 60 * 1000;
const BUCKET_MS = 30 * 60 * 1000;

function readStorageList(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

function writeStorageList(key, list) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch (err) {
    // ignore write errors
  }
}

function pruneByWindow(list, nowMs, windowMs) {
  const cutoff = nowMs - windowMs;
  return list.filter((item) => item && typeof item.ts === "number" && item.ts >= cutoff);
}

function loadSeenSnapshot(nowMs) {
  const raw = readStorageList(SEEN_KEY);
  const pruned = pruneByWindow(raw, nowMs, SEEN_WINDOW_MS);
  if (pruned.length !== raw.length) writeStorageList(SEEN_KEY, pruned);
  const ids = new Set(pruned.map((item) => item.id).filter(Boolean));
  return { list: pruned, ids };
}

function storeSeenItems(existing, ids, nowMs) {
  const map = new Map(existing.map((item) => [item.id, item]));
  ids.forEach((id) => {
    if (!id) return;
    map.set(id, { id, ts: nowMs });
  });
  return Array.from(map.values());
}

export default function MicroActionsCard({
  drag = false,
  setActivatorNodeRef,
  listeners,
  attributes,
  categoryId = "",
  categoryName = "",
  goalId = "",
  goalTitle = "",
  nextOccurrence = null,
  plannedToday = [],
  dayMicro = {},
  microDoneToday = 0,
  canValidate = false,
  onAddMicroCheck,
  library = MICRO_ACTIONS_LIBRARY,
}) {
  const effectiveCategoryId = categoryId || "general";
  const effectiveCategoryName = categoryName || "Général";
  const contextLabel = useMemo(() => {
    if (effectiveCategoryName) return `Pour ta catégorie • ${effectiveCategoryName}`;
    return "Pour aujourd’hui";
  }, [effectiveCategoryName]);

  const nowTs = Date.now();
  const bucket = Math.floor(nowTs / BUCKET_MS);
  const seedNowMs = bucket * BUCKET_MS;
  const hourNow = new Date(nowTs).getHours();
  const [rotationOffset, setRotationOffset] = useState(0);
  const [seenSnapshot, setSeenSnapshot] = useState(() => loadSeenSnapshot(nowTs));
  const [flashDoneId, setFlashDoneId] = useState("");
  const flashTimerRef = useRef(null);

  useEffect(() => {
    setRotationOffset(0);
    setSeenSnapshot(loadSeenSnapshot(Date.now()));
  }, [effectiveCategoryId, effectiveCategoryName]);

  useEffect(() => {
    setSeenSnapshot(loadSeenSnapshot(Date.now()));
  }, [bucket]);

  const engineContext = useMemo(
    () => ({
      categoryId: effectiveCategoryId,
      categoryName: effectiveCategoryName,
      hourNow,
      nowMs: seedNowMs,
      seedOffset: rotationOffset,
      seenIds: Array.from(seenSnapshot.ids),
      library,
    }),
    [effectiveCategoryId, effectiveCategoryName, hourNow, seedNowMs, rotationOffset, seenSnapshot.ids, library]
  );

  const displayItems = useMemo(() => getMicroActionsForToday(engineContext, 3), [engineContext]);

  useEffect(() => {
    if (!displayItems.length) return;
    const now = Date.now();
    const existing = readStorageList(SEEN_KEY);
    const updated = storeSeenItems(existing, displayItems.map((item) => item.id), now);
    const pruned = pruneByWindow(updated, now, SEEN_WINDOW_MS);
    writeStorageList(SEEN_KEY, pruned);
  }, [displayItems]);

  const handleRotate = useCallback(() => {
    setSeenSnapshot(loadSeenSnapshot(Date.now()));
    setRotationOffset((value) => value + 1);
  }, []);

  const logDone = useCallback(
    (item) => {
      const now = Date.now();
      const list = readStorageList(DONE_KEY);
      const entry = {
        id: item.id,
        ts: now,
        categoryId: effectiveCategoryId,
        goalId,
        actionTitle: goalTitle || "",
      };
      writeStorageList(DONE_KEY, [...list, entry].slice(-200));
    },
    [categoryId, goalId, goalTitle, nextOccurrence?.actionTitle]
  );

  const handleActionClick = useCallback(
    (item, canAdd) => {
      if (!canAdd) return;
      onAddMicroCheck?.(item.id);
      logDone(item);
      setFlashDoneId(item.id);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => {
        setFlashDoneId((prev) => (prev === item.id ? "" : prev));
      }, 1500);
    },
    [logDone, onAddMicroCheck]
  );

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  return (
    <Card className="microCard" data-tour-id="today-micro-card">
      <div className="microCardBody">
        <div className="microHeader">
          <div className="cardSectionTitleRow">
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
            <div className="cardSectionTitle">Micro-actions</div>
          </div>
          <button
            type="button"
            className="microRotateBtn"
            onClick={handleRotate}
            aria-label="Changer"
            title="Changer"
          >
            ↻
          </button>
        </div>
        <div className="microContext">{contextLabel}</div>
        <div className="microList">
          {displayItems.map((item) => {
            const isDone = Boolean(dayMicro?.[item.id]);
            const isFlashing = flashDoneId === item.id;
            const canAdd = canValidate && microDoneToday < 3 && !isDone;
            return (
              <div key={item.id} className="microItem">
                <div className="microItemMain">
                  <div className="microItemTitle">{item.title}</div>
                  {item.subtitle ? <div className="microItemSub">{item.subtitle}</div> : null}
                </div>
                <span className="microBadge">{item.durationMin} min</span>
                <Button
                  variant="ghost"
                  className="microActionBtn"
                  onClick={() => handleActionClick(item, canAdd)}
                  disabled={!canAdd}
                  aria-label={isDone || isFlashing ? "Déjà fait" : "Faire"}
                  title={
                    isDone || isFlashing ? "Déjà fait" : microDoneToday >= 3 ? "Limite atteinte (3/jour)" : "Faire"
                  }
                >
                  {isDone || isFlashing ? "Fait" : "Faire"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
