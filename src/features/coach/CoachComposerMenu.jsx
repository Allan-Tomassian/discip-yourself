import React from "react";
import { AppPopoverMenu } from "../../shared/ui/app";
import { COACH_SCREEN_COPY } from "../../ui/labels";

function MenuAction({ label, description, onClick }) {
  return (
    <button type="button" className="coachComposerMenuAction" onClick={onClick} role="menuitem">
      <span className="coachComposerMenuLabel">{label}</span>
      <span className="coachComposerMenuDescription" title={description}>
        {description}
      </span>
    </button>
  );
}

export default function CoachComposerMenu({
  open = false,
  anchorRect = null,
  anchorEl = null,
  onClose,
  onSelectStructuring,
  onSelectQuickCreate,
}) {
  return (
    <AppPopoverMenu
      open={open}
      anchorRect={anchorRect}
      anchorEl={anchorEl}
      onClose={onClose}
      ariaLabel={COACH_SCREEN_COPY.composerMenuAriaLabel}
      panelClassName="coachComposerMenuPanel"
    >
      <div className="coachComposerMenu">
        <MenuAction
          label={COACH_SCREEN_COPY.structuringModeLabel}
          description={COACH_SCREEN_COPY.structuringMenuDescription}
          onClick={onSelectStructuring}
        />
        <MenuAction
          label={COACH_SCREEN_COPY.quickCreateLabel}
          description={COACH_SCREEN_COPY.quickCreateMenuDescription}
          onClick={onSelectQuickCreate}
        />
      </div>
    </AppPopoverMenu>
  );
}
