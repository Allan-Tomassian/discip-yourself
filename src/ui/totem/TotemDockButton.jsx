import React from "react";
import { TOTEM_PERCH_IDLE_V1 } from "./totemAssets";

export default function TotemDockButton({
  hidden = false,
  variant = "B",
  bodyColor = "#F59E0B",
  accessory = "",
  birdHidden = false,
  isHiding = false,
  dockRef = null,
  nubRef = null,
  onPressDock,
  onPressNub,
}) {
  void variant;
  void bodyColor;

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
      <span className={`totemDockVisual${birdHidden ? " isBirdHidden" : ""}`} aria-hidden="true">
        <span className="totemDockEagleWrap">
          <img src={TOTEM_PERCH_IDLE_V1} alt="" className="totemDockEagleAsset" />
        </span>
        {accessory ? <span className="totemDockBirdAccessory" aria-hidden="true">{accessory}</span> : null}
      </span>
    </button>
  );
}
