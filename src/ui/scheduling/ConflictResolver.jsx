import React from "react";
import { AppActionRow, AppDialog, GhostButton, PrimaryButton } from "../../shared/ui/app";
import "./conflictResolver.css";

function formatRange(start, end) {
  if (!start) return "";
  if (!end || end === start) return start;
  return `${start}–${end}`;
}

export default function ConflictResolver({
  open,
  onClose,
  candidateLabel,
  conflicts = [],
  suggestions = [],
  onReplace,
  onShift,
  onUnset,
}) {
  if (!open) return null;
  return (
    <AppDialog open={open} onClose={onClose} className="conflictDialog" maxWidth={560}>
      <div className="conflictResolver" data-testid="conflict-resolver-modal">
        <div className="conflictResolverHeader">
          <div className="titleSm">Conflit d’horaire</div>
          <div className="small2 textMuted">
            {candidateLabel || "Cette action chevauche une occurrence existante."}
          </div>
        </div>

        {conflicts.length ? (
          <div className="conflictList">
            {conflicts.map((c) => (
              <div key={c.id} className="conflictItem">
                <div className="conflictTitle">{c.title}</div>
                <div className="small2 textMuted">
                  {c.dateKey} · {formatRange(c.start, c.end)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {suggestions.length ? (
          <div className="conflictSuggestions">
            <div className="small2 textMuted">Décaler vers :</div>
            <div className="conflictSuggestionActions">
              {suggestions.map((slot) => (
                <GhostButton key={slot} onClick={() => onShift(slot)}>
                  {slot}
                </GhostButton>
              ))}
            </div>
          </div>
        ) : null}

        <AppActionRow align="start" className="conflictResolverActions">
          <PrimaryButton onClick={onReplace} data-testid="conflict-resolver-replace">
            Remplacer
          </PrimaryButton>
          <GhostButton onClick={onUnset} data-testid="conflict-resolver-unset">
            Mettre sans horaire
          </GhostButton>
          <GhostButton onClick={onClose} data-testid="conflict-resolver-cancel">
            Annuler
          </GhostButton>
        </AppActionRow>
      </div>
    </AppDialog>
  );
}
