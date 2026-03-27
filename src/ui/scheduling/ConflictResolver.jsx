import React from "react";
import { GateButton } from "../../shared/ui/gate/Gate";
import GateDialog from "../../shared/ui/gate/GateDialog";
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
    <GateDialog open={open} onClose={onClose} className="conflictModal">
      <div className="stack stackGap12" data-testid="conflict-resolver-modal">
        <div className="titleSm">Conflit d’horaire</div>
        <div className="small2 textMuted">
          {candidateLabel || "Cette action chevauche une occurrence existante."}
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
          <div className="stack stackGap8">
            <div className="small2 textMuted">Décaler vers :</div>
            <div className="row rowWrap gap8">
              {suggestions.map((slot) => (
                <GateButton key={slot} variant="ghost" className="GatePressable" onClick={() => onShift(slot)}>
                  {slot}
                </GateButton>
              ))}
            </div>
          </div>
        ) : null}

        <div className="row rowWrap gap8">
          <GateButton className="GatePressable" onClick={onReplace} data-testid="conflict-resolver-replace">
            Remplacer
          </GateButton>
          <GateButton variant="ghost" className="GatePressable" onClick={onUnset} data-testid="conflict-resolver-unset">
            Mettre sans horaire
          </GateButton>
          <GateButton variant="ghost" className="GatePressable" onClick={onClose} data-testid="conflict-resolver-cancel">
            Annuler
          </GateButton>
        </div>
      </div>
    </GateDialog>
  );
}
