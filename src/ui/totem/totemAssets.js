import perchIdleV1 from "../../assets/totem/v1/perch_idle.png";
import eagleLandV1 from "../../assets/totem/v1/eagle_land.png";
import eagleThumbV1 from "../../assets/totem/v1/eagle_thumb.png";
import eagleFly01V1 from "../../assets/totem/v1/eagle_fly_01.png";
import eagleFly02V1 from "../../assets/totem/v1/eagle_fly_02.png";
import eagleFly03V1 from "../../assets/totem/v1/eagle_fly_03.png";
import eagleFly04V1 from "../../assets/totem/v1/eagle_fly_04.png";

export const TOTEM_PERCH_IDLE_V1 = perchIdleV1;
export const TOTEM_BRANCH_V1 = TOTEM_PERCH_IDLE_V1;
export const TOTEM_EAGLE_LAND_V1 = eagleLandV1;
export const TOTEM_EAGLE_THUMB_V1 = eagleThumbV1;
export const TOTEM_FLY_FRAMES_V1 = [eagleFly01V1, eagleFly02V1, eagleFly03V1, eagleFly04V1];

export const TOTEM_ASSETS_V1 = [
  TOTEM_PERCH_IDLE_V1,
  TOTEM_EAGLE_LAND_V1,
  TOTEM_EAGLE_THUMB_V1,
  ...TOTEM_FLY_FRAMES_V1,
];

let preloadPromise = null;

export function preloadTotemAssets() {
  if (typeof window === "undefined") return Promise.resolve();
  if (preloadPromise) return preloadPromise;

  preloadPromise = Promise.allSettled(
    TOTEM_ASSETS_V1.map((assetSrc) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ ok: true, assetSrc });
        image.onerror = () => resolve({ ok: false, assetSrc });
        image.src = assetSrc;
      })
    )
  ).then(() => undefined);

  return preloadPromise;
}
