import { useEffect, useRef } from "react";
import { applySessionRuntimeTransition, resolveRuntimeAutoFinish } from "../logic/sessionRuntime";
import { emitSessionRuntimeNotificationHook } from "../logic/sessionRuntimeNotifications";

export function useSessionRuntimeLoop({ setData, dataRef }) {
  const autoFinishSigRef = useRef("");

  useEffect(() => {
    if (typeof setData !== "function") return undefined;
    const id = setInterval(() => {
      const current = dataRef?.current;
      if (!current || typeof current !== "object") return;
      const nextEvent = resolveRuntimeAutoFinish(current, new Date());
      if (!nextEvent) return;
      const sig = `${nextEvent.occurrenceId || ""}:${nextEvent.durationSec || 0}:${nextEvent.dateKey || ""}`;
      if (autoFinishSigRef.current === sig) return;
      autoFinishSigRef.current = sig;
      setData((prev) => applySessionRuntimeTransition(prev, nextEvent));
      emitSessionRuntimeNotificationHook(nextEvent.type, {
        occurrenceId: nextEvent.occurrenceId,
        dateKey: nextEvent.dateKey,
        runtimePhase: "done",
        source: "auto_finish_loop",
      });
    }, 1000);
    return () => clearInterval(id);
  }, [setData, dataRef]);
}
