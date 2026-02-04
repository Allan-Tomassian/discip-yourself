import React from "react";
import { Button, Modal } from "../../components/UI";
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
    <Modal open={open} onClose={onClose} className="conflictModal">
      <div className="stack stackGap12">
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
                <Button key={slot} variant="ghost" onClick={() => onShift(slot)}>
                  {slot}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="row rowWrap gap8">
          <Button variant="primary" onClick={onReplace}>
            Remplacer
          </Button>
          <Button variant="ghost" onClick={onUnset}>
            Mettre sans horaire
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  );
}
