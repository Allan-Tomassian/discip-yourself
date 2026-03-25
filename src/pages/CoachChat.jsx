import React, { useMemo, useState } from "react";
import ScreenShell from "./_ScreenShell";
import { Button, Card, Textarea } from "../components/UI";
import { useAuth } from "../auth/useAuth";
import { requestAiCoachChat } from "../infra/aiCoachChatClient";
import { todayLocalKey } from "../utils/dateKey";
import { applySessionRuntimeTransition } from "../logic/sessionRuntime";
import { resolveExecutableOccurrence } from "../logic/sessionResolver";
import { applyChatDraftChanges } from "../logic/chatDraftChanges";
import { CATEGORY_VIEW, getSelectedCategoryForView } from "../domain/categoryVisibility";

function trimHistory(history) {
  const safeHistory = Array.isArray(history) ? history.filter(Boolean) : [];
  return safeHistory.slice(-6);
}

function findOccurrence(state, action, selectedDateKey) {
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const directMatch =
    typeof action?.occurrenceId === "string"
      ? occurrences.find((occurrence) => occurrence?.id === action.occurrenceId) || null
      : null;
  if (directMatch) return directMatch;

  const goalIds = typeof action?.actionId === "string" && action.actionId ? [action.actionId] : [];
  const resolved = resolveExecutableOccurrence(state, {
    dateKey: action?.dateKey || selectedDateKey,
    goalIds,
  });
  if (!resolved?.occurrenceId) return null;
  return occurrences.find((occurrence) => occurrence?.id === resolved.occurrenceId) || null;
}

function renderActionButtonLabel(action) {
  if (!action) return "";
  const durationLabel = Number.isFinite(action.suggestedDurationMin)
    ? `${action.suggestedDurationMin} min`
    : "";
  return [action.label, durationLabel].filter(Boolean).join(" • ");
}

function describeDraftChange(change, { goalsById, categoriesById }) {
  if (!change || typeof change !== "object") return "";
  const goalTitle =
    (typeof change.title === "string" && change.title.trim()) ||
    goalsById.get(change.actionId || "")?.title ||
    "Action";
  const categoryName = categoriesById.get(change.categoryId || "")?.name || null;
  const timingBits = [];
  if (change.dateKey) timingBits.push(change.dateKey);
  if (change.startTime) timingBits.push(change.startTime);
  if (Number.isFinite(change.durationMin)) timingBits.push(`${change.durationMin} min`);

  if (change.type === "create_action") {
    return ["Créer", goalTitle, categoryName, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "update_action") {
    return ["Mettre à jour", goalTitle, categoryName].filter(Boolean).join(" · ");
  }
  if (change.type === "schedule_action") {
    return ["Planifier", goalTitle, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "reschedule_occurrence") {
    return ["Replanifier", goalTitle, ...timingBits].filter(Boolean).join(" · ");
  }
  if (change.type === "archive_action") {
    return ["Archiver", goalTitle].filter(Boolean).join(" · ");
  }
  return goalTitle;
}

export default function CoachChat({ data, setData, setTab }) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const safeData = data && typeof data === "object" ? data : {};
  const safeUi = safeData?.ui && typeof safeData.ui === "object" ? safeData.ui : {};
  const selectedDateKey = safeUi.selectedDateKey || safeUi.selectedDate || todayLocalKey();
  const activeCategoryId =
    getSelectedCategoryForView(safeUi, CATEGORY_VIEW.TODAY) ||
    safeUi.selectedCategoryId ||
    null;
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applyingDraftId, setApplyingDraftId] = useState(null);
  const [error, setError] = useState("");

  const visibleHistory = useMemo(() => trimHistory(history), [history]);
  const categoriesById = useMemo(
    () => new Map((Array.isArray(safeData.categories) ? safeData.categories : []).map((category) => [category?.id, category])),
    [safeData.categories]
  );
  const goalsById = useMemo(
    () => new Map((Array.isArray(safeData.goals) ? safeData.goals : []).map((goal) => [goal?.id, goal])),
    [safeData.goals]
  );

  function applyAction(action) {
    if (!action || !action.intent) return;
    if (action.intent === "open_library") {
      setTab("library");
      return;
    }
    if (action.intent === "open_pilotage") {
      setTab("pilotage");
      return;
    }
    if (action.intent === "open_today") {
      setTab("today");
      return;
    }
    if (action.intent === "resume_session") {
      setTab("session", {
        sessionCategoryId: action.categoryId || activeCategoryId || null,
        sessionDateKey: action.dateKey || selectedDateKey,
      });
      return;
    }
    if (action.intent !== "start_occurrence") return;

    const occurrence = findOccurrence(safeData, action, selectedDateKey);
    if (!occurrence?.id) return;
    const occurrenceGoal = Array.isArray(safeData.goals)
      ? safeData.goals.find((goal) => goal?.id === occurrence.goalId) || null
      : null;
    setData((previous) =>
      applySessionRuntimeTransition(previous, {
        type: "start",
        occurrenceId: occurrence.id,
        dateKey: occurrence.date || action.dateKey || selectedDateKey,
        objectiveId: null,
        habitIds: occurrence.goalId ? [occurrence.goalId] : action.actionId ? [action.actionId] : [],
      })
    );
    setTab("session", {
      sessionCategoryId: occurrenceGoal?.categoryId || action.categoryId || activeCategoryId || null,
      sessionDateKey: occurrence.date || action.dateKey || selectedDateKey,
    });
  }

  function applyDraftProposal(entry) {
    if (!entry?.id || applyingDraftId) return;
    const draftChanges = Array.isArray(entry.reply?.draftChanges) ? entry.reply.draftChanges : [];
    if (!draftChanges.length) return;
    setApplyingDraftId(entry.id);
    setError("");
    let result = { state: safeData, appliedCount: 0, navigationTarget: null };
    setData((previous) => {
      result = applyChatDraftChanges(previous, draftChanges);
      return result.state;
    });
    setHistory((previous) =>
      previous.map((item) => {
        if (item.id !== entry.id) return item;
        if (result.appliedCount > 0) {
          return {
            ...item,
            draftApplyStatus: "applied",
            draftApplyMessage:
              result.appliedCount > 1
                ? `${result.appliedCount} changements appliqués.`
                : "Brouillon appliqué.",
          };
        }
        return {
          ...item,
          draftApplyStatus: "error",
          draftApplyMessage: "Aucun changement applicable dans l'état actuel.",
        };
      })
    );
    if (result.appliedCount > 0 && result.navigationTarget) {
      setTab(result.navigationTarget);
    }
    setApplyingDraftId(null);
  }

  async function submitMessage() {
    const message = draft.trim();
    if (!message || loading) return;
    setLoading(true);
    setError("");
    try {
      const userEntry = {
        id: `${Date.now()}_user`,
        role: "user",
        content: message,
      };
      const recentMessages = trimHistory([
        ...visibleHistory.map((entry) =>
          entry.role === "assistant"
            ? { role: "assistant", content: `${entry.reply?.headline || ""}. ${entry.reply?.reason || ""}`.trim() }
            : { role: "user", content: entry.content || "" }
        ),
        { role: "user", content: message },
      ]);
      const result = await requestAiCoachChat({
        accessToken,
        payload: {
          selectedDateKey,
          activeCategoryId,
          message,
          recentMessages,
        },
      });
      if (!result.ok || !result.reply) {
        setError("Impossible d'obtenir une reponse structuree pour le moment.");
        return;
      }
      const assistantEntry = {
        id: `${Date.now()}_assistant`,
        role: "assistant",
        reply: result.reply,
        draftApplyStatus: Array.isArray(result.reply?.draftChanges) && result.reply.draftChanges.length ? "idle" : null,
        draftApplyMessage: "",
      };
      setHistory((previous) => trimHistory([...previous, userEntry, assistantEntry]));
      setDraft("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenShell data={safeData} pageId="coach-chat" headerTitle="Coach" headerSubtitle="Reponse courte, orientee action">
      <div className="col" style={{ gap: 12 }}>
        <Card accentBorder>
          <div className="p18 col" style={{ gap: 12 }}>
            <div className="small">
              Pose une question courte. La reponse reste structuree et vise une prochaine action concrete.
            </div>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ex: Je suis en retard, quel est le meilleur prochain bloc ?"
            />
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="small2" style={{ opacity: 0.85 }}>
                Historique local limite a 3 tours.
              </div>
              <Button onClick={submitMessage} disabled={loading || !draft.trim()}>
                {loading ? "Analyse..." : "Envoyer"}
              </Button>
            </div>
            {error ? (
              <div className="small" role="alert" style={{ color: "#F87171" }}>
                {error}
              </div>
            ) : null}
          </div>
        </Card>

        {visibleHistory.map((entry) =>
          entry.role === "assistant" ? (
            <Card key={entry.id} accentBorder>
              <div className="p18 col" style={{ gap: 10 }}>
                <div className="titleSm">{entry.reply?.headline || "Action"}</div>
                <div className="small">{entry.reply?.reason || ""}</div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {entry.reply?.primaryAction ? (
                    <Button onClick={() => applyAction(entry.reply.primaryAction)}>
                      {renderActionButtonLabel({
                        ...entry.reply.primaryAction,
                        suggestedDurationMin: entry.reply.suggestedDurationMin,
                      })}
                    </Button>
                  ) : null}
                  {entry.reply?.secondaryAction ? (
                    <Button variant="ghost" onClick={() => applyAction(entry.reply.secondaryAction)}>
                      {entry.reply.secondaryAction.label}
                    </Button>
                  ) : null}
                </div>
                {Array.isArray(entry.reply?.draftChanges) && entry.reply.draftChanges.length ? (
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      paddingTop: 10,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div className="small2" style={{ opacity: 0.8 }}>
                      Brouillon d&apos;application
                    </div>
                    <div className="col" style={{ gap: 6 }}>
                      {entry.reply.draftChanges.map((change, index) => (
                        <div key={`${entry.id}_draft_${index}`} className="small2" style={{ opacity: 0.92 }}>
                          {describeDraftChange(change, { goalsById, categoriesById })}
                        </div>
                      ))}
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <Button
                        onClick={() => applyDraftProposal(entry)}
                        disabled={applyingDraftId === entry.id || entry.draftApplyStatus === "applied"}
                      >
                        {applyingDraftId === entry.id
                          ? "Application..."
                          : entry.draftApplyStatus === "applied"
                            ? "Appliqué"
                            : "Appliquer le brouillon"}
                      </Button>
                    </div>
                    {entry.draftApplyMessage ? (
                      <div
                        className="small2"
                        style={{ color: entry.draftApplyStatus === "error" ? "#F87171" : undefined, opacity: 0.9 }}
                      >
                        {entry.draftApplyMessage}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : (
            <Card key={entry.id}>
              <div className="p18">
                <div className="small2" style={{ opacity: 0.8 }}>
                  Toi
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  {entry.content}
                </div>
              </div>
            </Card>
          )
        )}
      </div>
    </ScreenShell>
  );
}
