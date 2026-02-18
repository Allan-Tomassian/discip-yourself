import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensureTotemV1, findTotemAccessoryById } from "../../logic/totemV1";
import { spendCoins } from "../../logic/walletV1";
import { onTotemEvent } from "./totemEvents";
import {
  TOTEM_EAGLE_LAND_V1,
  TOTEM_EAGLE_THUMB_V1,
  TOTEM_FLY_FRAMES_V1,
  preloadTotemAssets,
} from "./totemAssets";
import TotemDockButton from "./TotemDockButton";
import TotemDockPanel from "./TotemDockPanel";
import "./totemDock.css";

const PANEL_VIEWS = new Set(["wallet", "shop", "totem", "settings"]);
const DOCK_Z = {
  dock: 1100,
  ghost: 1140,
  scrim: 1190,
  panel: 1200,
};
const FLY_FRAME_MS = 140;
const FLY_OUT_MS = 680;
const LAND_HOLD_MS = 300;
const THUMB_HOLD_MS = 820;
const BACK_MS = 450;

function resolveDockFlyFrames(variant) {
  void variant;
  return TOTEM_FLY_FRAMES_V1;
}

function normalizeView(value) {
  const key = typeof value === "string" ? value.trim() : "";
  return PANEL_VIEWS.has(key) ? key : "wallet";
}

function ensureDockState(rawDock) {
  const source = rawDock && typeof rawDock === "object" ? rawDock : {};
  const hidden = source.hidden === true;
  const panelOpen = hidden ? false : source.panelOpen === true;
  const lastOpenView = normalizeView(source.lastOpenView);
  const variant = source.variant === "B" ? "B" : "B";
  const lastInteractionAt = Number.isFinite(source.lastInteractionAt) ? Math.max(0, Math.floor(source.lastInteractionAt)) : null;
  return {
    version: 1,
    hidden,
    panelOpen,
    lastOpenView,
    variant,
    lastInteractionAt,
  };
}

function ensureWalletData(rawWallet) {
  const source = rawWallet && typeof rawWallet === "object" ? rawWallet : {};
  const balance = Number.isFinite(source.balance) ? Math.max(0, Math.floor(source.balance)) : 0;
  const earnedToday = Number.isFinite(source.earnedToday) ? Math.max(0, Math.floor(source.earnedToday)) : 0;
  const adsToday = Number.isFinite(source.adsToday) ? Math.max(0, Math.floor(source.adsToday)) : 0;
  const dateKey = typeof source.dateKey === "string" && source.dateKey.trim() ? source.dateKey.trim() : "";
  const lastEvents = Array.isArray(source.lastEvents)
    ? source.lastEvents
        .filter((event) => event && typeof event === "object")
        .map((event) => ({
          ts: Number.isFinite(event.ts) ? event.ts : Date.now(),
          type: typeof event.type === "string" && event.type.trim() ? event.type.trim() : "micro_done",
          amount: Number.isFinite(event.amount) ? Math.max(0, Math.floor(event.amount)) : 0,
          ...(event.meta && typeof event.meta === "object" ? { meta: event.meta } : {}),
        }))
        .slice(-50)
    : [];
  return {
    version: 1,
    balance,
    earnedToday,
    adsToday,
    dateKey,
    lastEvents,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolveFlightTargetPoint(targetId, viewport, fallbackBase) {
  const fallbackPoint = {
    x: clamp((fallbackBase?.x || viewport.width * 0.68) - 86, 56, viewport.width - 56),
    y: clamp((fallbackBase?.y || viewport.height * 0.34) + 58, 88, viewport.height - 120),
    fallback: true,
  };
  if (typeof document === "undefined") return fallbackPoint;

  const key = typeof targetId === "string" && targetId.trim() ? targetId.trim() : "categoryRail";
  const target = document.querySelector(`[data-totem-target="${key}"]`);
  if (!target || typeof target.getBoundingClientRect !== "function") return fallbackPoint;
  const rect = target.getBoundingClientRect();
  const validRect = Number.isFinite(rect.left) && Number.isFinite(rect.top) && rect.width > 0 && rect.height > 0;
  if (!validRect) return fallbackPoint;

  const intersectsViewport =
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < viewport.width &&
    rect.top < viewport.height;
  if (!intersectsViewport) return fallbackPoint;

  return {
    x: rect.left + (rect.width * 0.5),
    y: rect.top + Math.min(rect.height * 0.38, 56),
    fallback: false,
  };
}

export default function TotemDockLayer({ data, setData }) {
  const canPersist = typeof setData === "function";
  const ui = data && typeof data === "object" && data.ui && typeof data.ui === "object" ? data.ui : {};
  const dockState = useMemo(() => ensureDockState(ui.totemDockV1), [ui.totemDockV1]);
  const walletData = useMemo(() => ensureWalletData(ui.walletV1), [ui.walletV1]);
  const totemData = useMemo(() => ensureTotemV1(ui.totemV1), [ui.totemV1]);
  const totemAccessoryPreview = (() => {
    const first = Array.isArray(totemData.equipped?.accessoryIds) ? totemData.equipped.accessoryIds[0] : "";
    return findTotemAccessoryById(first)?.emoji || "";
  })();

  const [activeView, setActiveView] = useState(() => dockState.lastOpenView);
  const [isHiding, setIsHiding] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("info");
  const [panelLayout, setPanelLayout] = useState({
    top: 64,
    left: 0,
    width: 360,
    maxHeight: 420,
  });
  const [flightState, setFlightState] = useState({
    phase: "idle",
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    size: 118,
    asset: "",
  });

  const dockRef = useRef(null);
  const nubRef = useRef(null);
  const hideTimeoutRef = useRef(0);
  const flightTimersRef = useRef([]);
  const flightFrameTimerRef = useRef(0);
  const flightFrameIndexRef = useRef(0);
  const flightPhaseRef = useRef("idle");
  const isMountedRef = useRef(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const persistDockState = useCallback((nextDock, extra = {}) => {
    if (!canPersist) return;
    setData((prev) => {
      const safePrev = prev && typeof prev === "object" ? prev : {};
      const safeUi = safePrev.ui && typeof safePrev.ui === "object" ? safePrev.ui : {};
      return {
        ...safePrev,
        ui: {
          ...safeUi,
          ...extra,
          totemDockV1: ensureDockState(nextDock),
        },
      };
    });
  }, [canPersist, setData]);

  const persistUiPatch = useCallback((patch = {}) => {
    if (!canPersist) return;
    setData((prev) => {
      const safePrev = prev && typeof prev === "object" ? prev : {};
      const safeUi = safePrev.ui && typeof safePrev.ui === "object" ? safePrev.ui : {};
      return {
        ...safePrev,
        ui: {
          ...safeUi,
          ...patch,
        },
      };
    });
  }, [canPersist, setData]);

  const computePanelLayout = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!dockState.panelOpen) return;

    const anchor = dockState.hidden ? nubRef.current : dockRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const vv = window.visualViewport;
    const vw = vv?.width || window.innerWidth || 0;
    const vh = vv?.height || window.innerHeight || 0;
    const styles = window.getComputedStyle(document.documentElement);
    const safeTop = Number.parseFloat(styles.getPropertyValue("--safe-top")) || 0;
    const safeRight = Number.parseFloat(styles.getPropertyValue("--safe-right")) || 0;
    const safeBottom = Number.parseFloat(styles.getPropertyValue("--safe-bottom")) || 0;
    const safeLeft = Number.parseFloat(styles.getPropertyValue("--safe-left")) || 0;

    const viewportPadding = 12;
    const panelWidth = Math.min(420, Math.max(300, vw - (viewportPadding * 2) - safeLeft - safeRight));
    const desiredTop = rect.bottom + 10;
    const desiredLeft = rect.right - panelWidth;
    const minLeft = viewportPadding + safeLeft;
    const maxLeft = vw - viewportPadding - safeRight - panelWidth;
    const left = minLeft <= maxLeft ? clamp(desiredLeft, minLeft, maxLeft) : minLeft;
    const top = Math.max(desiredTop, viewportPadding + safeTop);
    const maxHeight = Math.max(220, vh - top - (12 + safeBottom));

    setPanelLayout((prev) => {
      if (
        prev.top === top
        && prev.left === left
        && prev.width === panelWidth
        && prev.maxHeight === maxHeight
      ) {
        return prev;
      }
      return {
        top,
        left,
        width: panelWidth,
        maxHeight,
      };
    });
  }, [dockState.hidden, dockState.panelOpen]);

  useEffect(() => {
    setActiveView(dockState.lastOpenView);
  }, [dockState.lastOpenView]);

  useEffect(() => {
    isMountedRef.current = true;
    preloadTotemAssets();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    flightPhaseRef.current = flightState.phase;
  }, [flightState.phase]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyValue = () => setPrefersReducedMotion(media.matches === true);
    applyValue();
    const onChange = () => applyValue();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!dockState.panelOpen) return undefined;
    if (typeof window === "undefined") return undefined;
    const update = () => computePanelLayout();
    update();
    const raf = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [dockState.panelOpen, computePanelLayout]);

  useEffect(() => {
    if (!dockState.panelOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      const nextDock = {
        ...dockState,
        panelOpen: false,
        lastInteractionAt: Date.now(),
      };
      persistDockState(nextDock);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [dockState, persistDockState]);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      if (flightFrameTimerRef.current) {
        window.clearInterval(flightFrameTimerRef.current);
      }
      if (Array.isArray(flightTimersRef.current)) {
        flightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      }
      flightFrameTimerRef.current = 0;
      flightTimersRef.current = [];
    };
  }, []);

  const clearFlightTimers = useCallback(() => {
    if (flightFrameTimerRef.current) {
      window.clearInterval(flightFrameTimerRef.current);
      flightFrameTimerRef.current = 0;
    }
    if (!Array.isArray(flightTimersRef.current)) return;
    flightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    flightTimersRef.current = [];
  }, []);

  const startFlyFrameLoop = useCallback((frames) => {
    if (!Array.isArray(frames) || !frames.length) return;
    if (flightFrameTimerRef.current) {
      window.clearInterval(flightFrameTimerRef.current);
      flightFrameTimerRef.current = 0;
    }
    flightFrameTimerRef.current = window.setInterval(() => {
      if (!isMountedRef.current) return;
      flightFrameIndexRef.current = (flightFrameIndexRef.current + 1) % frames.length;
      const nextAsset = frames[flightFrameIndexRef.current];
      setFlightState((current) => {
        if (current.phase !== "out" && current.phase !== "back") return current;
        if (!nextAsset || current.asset === nextAsset) return current;
        return {
          ...current,
          asset: nextAsset,
        };
      });
    }, FLY_FRAME_MS);
  }, []);

  const stopFlight = useCallback(() => {
    clearFlightTimers();
    flightFrameIndexRef.current = 0;
    setFlightState((current) => {
      if (current.phase === "idle") return current;
      return {
        phase: "idle",
        fromX: 0,
        fromY: 0,
        toX: 0,
        toY: 0,
        size: 118,
        asset: "",
      };
    });
  }, [clearFlightTimers]);

  const startFlightToTarget = useCallback((targetId = "categoryRail") => {
    if (dockState.hidden || isHiding) return;
    if (flightPhaseRef.current !== "idle") return;
    if (typeof window === "undefined") return;

    const anchorNode = dockRef.current;
    if (!anchorNode) return;
    const eagleNode = anchorNode.querySelector(".totemDockEagleWrap") || anchorNode;
    const fromRect = eagleNode.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewport = {
      width: vv?.width || window.innerWidth || 0,
      height: vv?.height || window.innerHeight || 0,
    };

    const fromX = fromRect.left + (fromRect.width * 0.55);
    const fromY = fromRect.top + (fromRect.height * 0.56);
    const targetPoint = resolveFlightTargetPoint(targetId, viewport, { x: fromX, y: fromY });
    const toX = targetPoint.x;
    const toY = targetPoint.y;
    const size = Math.max(96, Math.min(150, fromRect.width || 118));
    const flyFrames = resolveDockFlyFrames(dockState.variant);
    const flyAsset = flyFrames[0] || TOTEM_EAGLE_LAND_V1 || TOTEM_EAGLE_THUMB_V1;
    const landAsset = TOTEM_EAGLE_LAND_V1 || flyAsset;
    const thumbAsset = TOTEM_EAGLE_THUMB_V1 || landAsset;
    const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;
    if (targetPoint.fallback && isDev && typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug(`[totem-flight] fallback target used for "${targetId}"`);
    }

    clearFlightTimers();
    flightFrameIndexRef.current = 0;

    if (prefersReducedMotion) {
      setFlightState({
        phase: "thumb",
        fromX,
        fromY,
        toX: fromX,
        toY: fromY,
        size,
        asset: thumbAsset,
      });
      const reducedTimer = window.setTimeout(() => {
        stopFlight();
      }, THUMB_HOLD_MS);
      flightTimersRef.current = [reducedTimer];
      return;
    }

    setFlightState({
      phase: "out",
      fromX,
      fromY,
      toX,
      toY,
      size,
      asset: flyAsset,
    });
    startFlyFrameLoop(flyFrames);

    const trackTimer = (timerId) => {
      flightTimersRef.current = [...flightTimersRef.current, timerId];
      return timerId;
    };

    flightTimersRef.current = [];
    trackTimer(
      window.setTimeout(() => {
        setFlightState((current) => {
          if (current.phase === "idle") return current;
          return {
            ...current,
            phase: "land",
            asset: landAsset,
          };
        });

        trackTimer(
          window.setTimeout(() => {
            if (flightFrameTimerRef.current) {
              window.clearInterval(flightFrameTimerRef.current);
              flightFrameTimerRef.current = 0;
            }
            setFlightState((current) => {
              if (current.phase === "idle") return current;
              return {
                ...current,
                phase: "thumb",
                asset: thumbAsset,
              };
            });

            trackTimer(
              window.setTimeout(() => {
                startFlyFrameLoop(flyFrames);
                setFlightState((current) => {
                  if (current.phase === "idle") return current;
                  return {
                    ...current,
                    phase: "back",
                    asset: flyFrames[flightFrameIndexRef.current] || flyAsset,
                  };
                });

                trackTimer(
                  window.setTimeout(() => {
                    stopFlight();
                  }, BACK_MS)
                );
              }, THUMB_HOLD_MS)
            );
          }, LAND_HOLD_MS)
        );
      }, FLY_OUT_MS)
    );
  }, [clearFlightTimers, dockState.hidden, dockState.variant, isHiding, prefersReducedMotion, startFlyFrameLoop, stopFlight]);

  useEffect(() => {
    const unsubscribe = onTotemEvent((event) => {
      if (!event || event.type !== "MICRO_DONE") return;
      const targetId = event?.payload?.target || "categoryRail";
      startFlightToTarget(targetId);
    });
    return unsubscribe;
  }, [startFlightToTarget]);

  useEffect(() => {
    if (!dockState.hidden) return;
    stopFlight();
  }, [dockState.hidden, stopFlight]);

  const openPanelTo = useCallback((viewId) => {
    const nextView = normalizeView(viewId || activeView);
    setStatusMessage("");
    setStatusTone("info");
    setActiveView(nextView);
    const nextDock = {
      ...dockState,
      hidden: false,
      panelOpen: true,
      lastOpenView: nextView,
      lastInteractionAt: Date.now(),
    };
    persistDockState(nextDock);
  }, [activeView, dockState, persistDockState]);

  const closePanel = useCallback(() => {
    const nextDock = {
      ...dockState,
      panelOpen: false,
      lastInteractionAt: Date.now(),
    };
    persistDockState(nextDock);
  }, [dockState, persistDockState]);

  const handleDockPress = useCallback(() => {
    if (flightState.phase !== "idle") {
      stopFlight();
      return;
    }
    if (dockState.hidden) {
      openPanelTo(dockState.lastOpenView);
      return;
    }
    if (dockState.panelOpen) {
      closePanel();
      return;
    }
    openPanelTo(dockState.lastOpenView);
  }, [flightState.phase, stopFlight, dockState.hidden, dockState.lastOpenView, dockState.panelOpen, openPanelTo, closePanel]);

  const handleNubPress = useCallback(() => {
    openPanelTo(dockState.lastOpenView);
  }, [dockState.lastOpenView, openPanelTo]);

  const handleChangeView = useCallback((viewId) => {
    const nextView = normalizeView(viewId);
    setStatusMessage("");
    setStatusTone("info");
    setActiveView(nextView);
    const nextDock = {
      ...dockState,
      hidden: false,
      panelOpen: true,
      lastOpenView: nextView,
      lastInteractionAt: Date.now(),
    };
    persistDockState(nextDock);
  }, [dockState, persistDockState]);

  const handleHideDock = useCallback(() => {
    if (isHiding) return;
    setStatusMessage("");
    setStatusTone("info");
    setIsHiding(true);
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsHiding(false);
      const nextDock = {
        ...dockState,
        hidden: true,
        panelOpen: false,
        lastInteractionAt: Date.now(),
      };
      persistDockState(nextDock);
    }, 780);
  }, [dockState, isHiding, persistDockState]);

  const handleToggleAnimations = useCallback(() => {
    const nextTotem = {
      ...totemData,
      animationEnabled: !totemData.animationEnabled,
    };
    setStatusMessage(nextTotem.animationEnabled ? "Animations activées." : "Animations désactivées.");
    setStatusTone("info");
    persistUiPatch({
      totemV1: nextTotem,
      totemDockV1: {
        ...dockState,
        lastInteractionAt: Date.now(),
      },
    });
  }, [dockState, persistUiPatch, totemData]);

  const handleSelectColor = useCallback((colorOption) => {
    if (!colorOption?.id || !colorOption?.color) return;

    const owned = totemData.owned.colors.includes(colorOption.id);
    const isEquipped = String(totemData.equipped.bodyColor).toLowerCase() === String(colorOption.color).toLowerCase();
    if (isEquipped) return;

    let nextWallet = walletData;
    let nextOwnedColors = [...totemData.owned.colors];
    if (!owned) {
      const spendResult = spendCoins(walletData, colorOption.price, {
        type: "totem_shop",
        meta: { itemType: "color", itemId: colorOption.id },
      });
      if (!spendResult.spent) {
        setStatusMessage("Solde insuffisant pour cette couleur.");
        setStatusTone("error");
        return;
      }
      nextWallet = spendResult.wallet;
      nextOwnedColors = Array.from(new Set([...nextOwnedColors, colorOption.id]));
    }

    const nextTotem = {
      ...totemData,
      owned: {
        ...totemData.owned,
        colors: nextOwnedColors,
      },
      equipped: {
        ...totemData.equipped,
        bodyColor: colorOption.color,
      },
    };

    setStatusMessage(owned ? "Couleur équipée." : "Couleur achetée et équipée.");
    setStatusTone("info");
    persistUiPatch({
      walletV1: nextWallet,
      totemV1: nextTotem,
      totemDockV1: {
        ...dockState,
        lastInteractionAt: Date.now(),
      },
    });
  }, [dockState, persistUiPatch, totemData, walletData]);

  const handleToggleAccessory = useCallback((item) => {
    if (!item?.id) return;

    const owned = totemData.owned.accessories.includes(item.id);
    const equippedIds = Array.isArray(totemData.equipped.accessoryIds) ? totemData.equipped.accessoryIds : [];
    const isEquipped = equippedIds.includes(item.id);

    let nextWallet = walletData;
    let nextOwnedAccessories = [...totemData.owned.accessories];
    let nextEquipped = [...equippedIds];

    if (!owned) {
      const spendResult = spendCoins(walletData, item.price, {
        type: "totem_shop",
        meta: { itemType: "accessory", itemId: item.id },
      });
      if (!spendResult.spent) {
        setStatusMessage("Solde insuffisant pour cet accessoire.");
        setStatusTone("error");
        return;
      }
      nextWallet = spendResult.wallet;
      nextOwnedAccessories = Array.from(new Set([...nextOwnedAccessories, item.id]));
    }

    if (isEquipped) {
      nextEquipped = nextEquipped.filter((id) => id !== item.id);
    } else {
      nextEquipped = Array.from(new Set([...nextEquipped, item.id]));
    }

    const nextTotem = {
      ...totemData,
      owned: {
        ...totemData.owned,
        accessories: nextOwnedAccessories,
      },
      equipped: {
        ...totemData.equipped,
        accessoryIds: nextEquipped,
      },
    };

    if (!owned) setStatusMessage("Accessoire acheté et équipé.");
    else setStatusMessage(isEquipped ? "Accessoire retiré." : "Accessoire équipé.");
    setStatusTone("info");
    persistUiPatch({
      walletV1: nextWallet,
      totemV1: nextTotem,
      totemDockV1: {
        ...dockState,
        lastInteractionAt: Date.now(),
      },
    });
  }, [dockState, persistUiPatch, totemData, walletData]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="totemDockLayer" aria-hidden={dockState.panelOpen ? "false" : "true"}>
      <div className="totemDockAnchor" style={{ zIndex: DOCK_Z.dock }}>
        <TotemDockButton
          hidden={dockState.hidden}
          variant={dockState.variant}
          bodyColor={totemData.equipped.bodyColor}
          accessory={totemAccessoryPreview}
          birdHidden={flightState.phase !== "idle"}
          isHiding={isHiding}
          dockRef={dockRef}
          nubRef={nubRef}
          onPressDock={handleDockPress}
          onPressNub={handleNubPress}
        />
      </div>

      {flightState.phase !== "idle" ? (
        <div className="totemGhostLayer" style={{ zIndex: DOCK_Z.ghost }} aria-hidden="true">
          <button
            type="button"
            className={`totemGhost totemGhost--${flightState.phase}`}
            style={{
              left: `${flightState.phase === "back" || flightState.phase === "land" || flightState.phase === "thumb" ? flightState.toX : flightState.fromX}px`,
              top: `${flightState.phase === "back" || flightState.phase === "land" || flightState.phase === "thumb" ? flightState.toY : flightState.fromY}px`,
              "--totem-flight-dx": `${flightState.toX - flightState.fromX}px`,
              "--totem-flight-dy": `${flightState.toY - flightState.fromY}px`,
              "--totem-ghost-size": `${flightState.size}px`,
            }}
            data-testid="totem-ghost"
            onClick={stopFlight}
            aria-label="Passer l’animation du totem"
          >
            {flightState.asset ? <img src={flightState.asset} alt="" className="totemGhostAsset" /> : null}
          </button>
        </div>
      ) : null}

      {dockState.panelOpen ? (
        <>
          <div
            className="totemDockScrim"
            style={{ zIndex: DOCK_Z.scrim }}
            aria-hidden="true"
            onClick={closePanel}
          />
          <div
            className="totemDockPanelLayer"
            style={{
              zIndex: DOCK_Z.panel,
              top: `${panelLayout.top}px`,
              left: `${panelLayout.left}px`,
              width: `${panelLayout.width}px`,
              "--totemDockPanelMaxH": `${panelLayout.maxHeight}px`,
            }}
          >
            <TotemDockPanel
              view={activeView}
              walletData={walletData}
              totemData={totemData}
              statusMessage={statusMessage}
              statusTone={statusTone}
              onChangeView={handleChangeView}
              onClose={closePanel}
              onHideDock={handleHideDock}
              onToggleAnimations={handleToggleAnimations}
              onSelectColor={handleSelectColor}
              onToggleAccessory={handleToggleAccessory}
            />
          </div>
        </>
      ) : null}
    </div>,
    document.body
  );
}
