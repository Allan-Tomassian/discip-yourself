import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { requestAiCoachChat } from "../../infra/aiCoachChatClient";
import { applyChatDraftChanges } from "../../logic/chatDraftChanges";
import { buildPlanningCoachFallback } from "../../features/planning/planningCoachModel";
import { Button, Card } from "../UI";

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
  return [goalTitle, categoryName, ...timingBits].filter(Boolean).join(" · ");
}

function renderSuggestion(reply) {
  const label = reply?.primaryAction?.label || "Ajuster le planning";
  const duration = Number.isFinite(reply?.suggestedDurationMin) ? `${reply.suggestedDurationMin} min` : "";
  return [label, duration].filter(Boolean).join(" • ");
}

export default function PlanningCoachCard({
  data,
  setData,
  setTab,
  selectedDateKey,
  activeCategoryId = null,
  planningView = "day",
  occurrences = [],
  goalsById,
  categoriesById,
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const fallbackReply = useMemo(
    () =>
      buildPlanningCoachFallback({
        selectedDateKey,
        activeCategoryId,
        occurrences,
        goalsById,
        categoriesById,
      }),
    [activeCategoryId, categoriesById, goalsById, occurrences, selectedDateKey]
  );
  const [reply, setReply] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ignoredDraftKey, setIgnoredDraftKey] = useState("");
  const [applying, setApplying] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setReply(null);
    setIgnoredDraftKey("");
    setDraftMessage("");

    if (!accessToken) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    requestAiCoachChat({
      accessToken,
      payload: {
        selectedDateKey,
        activeCategoryId,
        message:
          planningView === "week"
            ? "Analyse ce planning hebdomadaire et propose un ajustement prioritaire concret."
            : "Analyse ce planning du jour et propose un ajustement prioritaire concret.",
        recentMessages: [],
      },
    })
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.reply) {
          setReply(result.reply);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeCategoryId, planningView, selectedDateKey]);

  const visibleReply = reply || fallbackReply;
  const draftChanges = Array.isArray(visibleReply?.draftChanges) ? visibleReply.draftChanges : [];
  const draftKey = draftChanges.length ? JSON.stringify(draftChanges) : "";
  const showDraft = Boolean(draftChanges.length && draftKey !== ignoredDraftKey);

  function applyDraft() {
    if (!showDraft || applying) return;
    setApplying(true);
    setDraftMessage("");
    let result = { state: data, appliedCount: 0, navigationTarget: null };
    setData((previous) => {
      result = applyChatDraftChanges(previous, draftChanges);
      return result.state;
    });
    if (result.appliedCount > 0) {
      setDraftMessage(
        result.appliedCount > 1 ? `${result.appliedCount} changements appliqués.` : "Brouillon appliqué."
      );
      if (result.navigationTarget) setTab?.(result.navigationTarget);
      setIgnoredDraftKey(draftKey);
    } else {
      setDraftMessage("Aucun changement applicable dans l’état actuel.");
    }
    setApplying(false);
  }

  return (
    <Card accentBorder>
      <div className="p18 col" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="titleSm">Coach planning</div>
            <div className="small2" style={{ opacity: 0.82 }}>
              {loading ? "Analyse IA en cours, heuristique locale visible." : reply ? "Suggestion IA active." : "Heuristique locale active."}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 8 }}>
          <div className="titleSm">{visibleReply?.headline || "Ajustement du planning"}</div>
          <div>
            <div className="small2" style={{ opacity: 0.7 }}>Insight</div>
            <div className="small">{visibleReply?.reason || "Le planning a besoin d’un ajustement simple et crédible."}</div>
          </div>
          <div>
            <div className="small2" style={{ opacity: 0.7 }}>Suggestion</div>
            <div className="small">{renderSuggestion(visibleReply)}</div>
          </div>
        </div>

        {showDraft ? (
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              paddingTop: 12,
              display: "grid",
              gap: 8,
            }}
          >
            <div className="small2" style={{ opacity: 0.78 }}>
              Brouillon proposé
            </div>
            <div className="col" style={{ gap: 6 }}>
              {draftChanges.map((change, index) => (
                <div key={`planning-draft-${index}`} className="small2">
                  {describeDraftChange(change, { goalsById, categoriesById })}
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Button onClick={applyDraft} disabled={applying}>
                {applying ? "Application..." : "Appliquer"}
              </Button>
              <Button variant="ghost" onClick={() => setIgnoredDraftKey(draftKey)}>
                Ignorer
              </Button>
            </div>
          </div>
        ) : null}

        {draftMessage ? (
          <div className="small2" style={{ opacity: 0.88 }}>
            {draftMessage}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
