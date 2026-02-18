import React from "react";

export default function TotemDockButton({
  hidden = false,
  bodyColor = "#F59E0B",
  accessory = "",
  isHiding = false,
  dockRef = null,
  nubRef = null,
  onPressDock,
  onPressNub,
}) {
  if (hidden) {
    return (
      <button
        ref={nubRef}
        type="button"
        className="totemDockNub GatePressable"
        data-testid="totem-nub"
        aria-label="Afficher le totem"
        onClick={onPressNub}
      >
        <span className="totemDockNubGlyph" aria-hidden="true">🪶</span>
      </button>
    );
  }

  return (
    <button
      ref={dockRef}
      type="button"
      className={`totemDockButton GatePressable${isHiding ? " isHiding" : ""}`}
      data-testid="totem-dock"
      aria-label="Ouvrir le dock totem"
      onClick={onPressDock}
      disabled={isHiding}
    >
      <span className="totemDockBranch" aria-hidden="true" />
      <span className="totemDockBird" style={{ "--totem-dock-body": bodyColor }}>
        <span className="totemDockBirdGlyph" aria-hidden="true">🦅</span>
        {accessory ? <span className="totemDockBirdAccessory" aria-hidden="true">{accessory}</span> : null}
      </span>
    </button>
  );
}
