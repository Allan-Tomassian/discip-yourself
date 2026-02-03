import React, { useMemo, useRef, useState, useEffect } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card } from "../components/UI";
import { setOccurrenceStatusById } from "../logic/occurrences";
import { normalizeActiveSessionForUI, normalizeOccurrenceForUI } from "../logic/compat";
import { getAccentForPage } from "../utils/_theme";
import { getCategoryAccentVars } from "../utils/categoryAccent";
import { toLocalDateKey } from "../utils/dateKey";
import {
  listUpcomingPlannedOccurrences,
  resolveCurrentPlannedOccurrence,
  resolveOccurrenceStartMs,
} from "../ui/session/sessionPlanner";
import "../ui/session/session.css";

function formatStatusLabel(status) {
  if (status === "done") return "Fait";
  if (status === "skipped") return "Reportée";
  if (status === "canceled") return "Annulée";
  return "Planifiée";
}

function formatDateLabel(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return "";
  const todayKey = toLocalDateKey(new Date());
  if (dateKey === todayKey) return "Aujourd’hui";
  return `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;
}

export default function SessionMVP({ data, setData, onBack, categoryId }) {
  const safeData = data && typeof data === "object" ? data : {};
  const categories = Array.isArray(safeData.categories) ? safeData.categories : [];
  const goals = Array.isArray(safeData.goals) ? safeData.goals : [];
  const occurrences = Array.isArray(safeData.occurrences) ? safeData.occurrences : [];
  const goalsById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const rawActiveSession =
    safeData.ui && typeof safeData.ui.activeSession === "object" ? safeData.ui.activeSession : null;
  const activeSession = useMemo(() => normalizeActiveSessionForUI(rawActiveSession), [rawActiveSession]);
  const activeOccurrence = useMemo(() => {
    if (!activeSession?.occurrenceId) return null;
    return occurrences.find((occ) => occ && occ.id === activeSession.occurrenceId) || null;
  }, [activeSession?.occurrenceId, occurrences]);

  const plannedOccurrences = useMemo(() => {
    const catFilter = typeof categoryId === "string" ? categoryId : "";
    return occurrences.filter((occ) => {
      if (!occ || occ.status !== "planned") return false;
      if (!catFilter) return true;
      const goal = goalsById.get(occ.goalId);
      return goal?.categoryId === catFilter;
    });
  }, [occurrences, goalsById, categoryId]);

  const nowRef = useRef(new Date());
  useEffect(() => {
    nowRef.current = new Date();
  }, [plannedOccurrences.length]);

  const currentPlannedOccurrence = useMemo(
    () => resolveCurrentPlannedOccurrence(plannedOccurrences, nowRef.current),
    [plannedOccurrences]
  );
  const upcomingOccurrences = useMemo(
    () => listUpcomingPlannedOccurrences(plannedOccurrences, nowRef.current, 4),
    [plannedOccurrences]
  );

  const userSelectedRef = useRef(false);
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(
    () => activeOccurrence?.id || currentPlannedOccurrence?.id || upcomingOccurrences[0]?.id || null
  );
  useEffect(() => {
    if (activeOccurrence?.id) {
      userSelectedRef.current = false;
      setSelectedOccurrenceId(activeOccurrence.id);
      return;
    }
    if (userSelectedRef.current) return;
    const fallbackId = currentPlannedOccurrence?.id || upcomingOccurrences[0]?.id || null;
    setSelectedOccurrenceId(fallbackId);
  }, [activeOccurrence?.id, currentPlannedOccurrence?.id, upcomingOccurrences]);

  const selectedOccurrence =
    occurrences.find((occ) => occ && occ.id === selectedOccurrenceId) ||
    currentPlannedOccurrence ||
    upcomingOccurrences[0] ||
    null;
  const selectedOccurrenceUI = selectedOccurrence ? normalizeOccurrenceForUI(selectedOccurrence) : null;
  const selectedGoal = selectedOccurrence ? goalsById.get(selectedOccurrence.goalId) || null : null;
  const selectedCategory = selectedGoal
    ? categories.find((c) => c && c.id === selectedGoal.categoryId) || null
    : null;
  const accent = selectedCategory?.color || getAccentForPage(safeData, "home");
  const accentVars = getCategoryAccentVars(accent);
  const timeLabel =
    selectedOccurrenceUI?.start && selectedOccurrenceUI.start !== "00:00"
      ? selectedOccurrenceUI.start
      : formatDateLabel(selectedOccurrence?.date);
  const statusLabel = formatStatusLabel(selectedOccurrence?.status);
  const occurrenceTitle = selectedGoal?.title || "Action";
  const categoryLabel = selectedCategory?.name || "Catégorie";

  const [showPicker, setShowPicker] = useState(false);

  const updateOccurrenceStatus = (status) => {
    if (!selectedOccurrence || typeof setData !== "function") return;
    setData((prev) => {
      const nextOccurrences = setOccurrenceStatusById(selectedOccurrence.id, status, prev);
      const prevUi = prev?.ui && typeof prev.ui === "object" ? prev.ui : {};
      const current = prevUi.activeSession && typeof prevUi.activeSession === "object" ? prevUi.activeSession : null;
      const nextActive =
        current && current.occurrenceId === selectedOccurrence.id ? null : prevUi.activeSession || null;
      return {
        ...prev,
        occurrences: nextOccurrences,
        ui: {
          ...prevUi,
          activeSession: nextActive,
        },
      };
    });
  };

  return (
    <ScreenShell
      accent={accent}
      headerTitle={<span>Session</span>}
      headerSubtitle={<span>Exécution</span>}
      headerRight={
        <button type="button" className="linkBtn" onClick={onBack}>
          Fermer
        </button>
      }
      headerRowAlign="start"
    >
      <div className="stack stackGap12" style={{ maxWidth: 720, margin: "0 auto" }}>
        <Card className="sessionCard" style={accentVars}>
          <div className="sessionCardBody">
            {selectedOccurrence ? (
              <>
                <div className="sessionTitleRow">
                  <div className="titleSm">Session</div>
                  <div className="sessionMeta">{categoryLabel}</div>
                </div>
                <div className="sessionOccurrence">
                  <div className="sessionOccurrenceTitle">{occurrenceTitle}</div>
                  <div className="sessionOccurrenceMeta">
                    {timeLabel || "À planifier"} · {statusLabel}
                  </div>
                </div>
                <div className="sessionActions">
                  <Button variant="ghost" onClick={() => updateOccurrenceStatus("skipped")}>
                    Reporter
                  </Button>
                  <Button variant="ghost" onClick={() => updateOccurrenceStatus("canceled")}>
                    Annuler
                  </Button>
                  <Button onClick={() => updateOccurrenceStatus("done")}>Terminer</Button>
                </div>
                <div className="sessionChangeRow">
                  <button
                    type="button"
                    className="linkBtn"
                    onClick={() => setShowPicker((v) => !v)}
                  >
                    Changer
                  </button>
                </div>
                {showPicker ? (
                  <div className="sessionPicker">
                    {upcomingOccurrences.length ? (
                      upcomingOccurrences.map((occ) => {
                        const occGoal = goalsById.get(occ.goalId) || null;
                        const occUi = normalizeOccurrenceForUI(occ);
                        const occTime =
                          occUi?.start && occUi.start !== "00:00" ? occUi.start : formatDateLabel(occ.date);
                        const occStartMs = resolveOccurrenceStartMs(occ);
                        const label = `${occGoal?.title || "Action"} · ${occTime || "Journée"}`;
                        return (
                          <button
                            key={occ.id}
                            type="button"
                            className={`sessionPickerItem${occ.id === selectedOccurrence?.id ? " is-active" : ""}`}
                            onClick={() => {
                              userSelectedRef.current = true;
                              setSelectedOccurrenceId(occ.id);
                              if (Number.isFinite(occStartMs)) nowRef.current = new Date(occStartMs);
                              setShowPicker(false);
                            }}
                          >
                            <span>{label}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="small2 textMuted2">Aucune occurrence planifiée.</div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="sessionEmpty">
                <div className="titleSm">Aucune occurrence planifiée</div>
                <div className="small2 textMuted2">Planifie une action pour démarrer une session.</div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </ScreenShell>
  );
}
