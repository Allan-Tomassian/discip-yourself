import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ensureTotemV1, findTotemAccessoryById } from "../../logic/totemV1";
import { spendCoins } from "../../logic/walletV1";
import TotemDockButton from "./TotemDockButton";
import TotemDockPanel from "./TotemDockPanel";
import "./totemDock.css";

const PANEL_VIEWS = new Set(["wallet", "shop", "totem", "settings"]);
const DOCK_Z = {
  dock: 1100,
  scrim: 1190,
  panel: 1200,
};

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

  const dockRef = useRef(null);
  const nubRef = useRef(null);
  const hideTimeoutRef = useRef(0);

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
    };
  }, []);

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
    if (dockState.hidden) {
      openPanelTo(dockState.lastOpenView);
      return;
    }
    if (dockState.panelOpen) {
      closePanel();
      return;
    }
    openPanelTo(dockState.lastOpenView);
  }, [dockState.hidden, dockState.lastOpenView, dockState.panelOpen, openPanelTo, closePanel]);

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
          bodyColor={totemData.equipped.bodyColor}
          accessory={totemAccessoryPreview}
          isHiding={isHiding}
          dockRef={dockRef}
          nubRef={nubRef}
          onPressDock={handleDockPress}
          onPressNub={handleNubPress}
        />
      </div>

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
