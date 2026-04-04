import React from "react";
import { LABELS } from "../ui/labels";
import { AppPopoverMenu, GhostButton, PrimaryButton } from "../shared/ui/app";

export default function PlusExpander({
  open,
  anchorRect,
  anchorEl,
  onClose,
  onChooseObjective,
  onChooseAction,
  onResumeDraft,
  hasDraft = false,
}) {
  return (
    <AppPopoverMenu
      open={open}
      anchorRect={anchorRect}
      anchorEl={anchorEl}
      onClose={onClose}
      ariaLabel="Créer"
      className="plusExpander"
      panelClassName="plusExpanderPanelContent"
    >
      <div className="plusExpanderActions">
        <PrimaryButton className="plusExpanderAction" onClick={onChooseAction}>
          Action rapide
        </PrimaryButton>
        <GhostButton className="plusExpanderAction" onClick={onChooseObjective}>
          {LABELS.goal}
        </GhostButton>
        {hasDraft && typeof onResumeDraft === "function" ? (
          <GhostButton className="plusExpanderAction" onClick={onResumeDraft}>
            Reprendre
          </GhostButton>
        ) : null}
      </div>
    </AppPopoverMenu>
  );
}
