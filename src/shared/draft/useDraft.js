import { useRef, useSyncExternalStore } from "react";
import { createDraftStore } from "./draftStore";

export function useDraftStore(options = {}) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = createDraftStore(options);
  }

  useSyncExternalStore(
    storeRef.current.subscribe,
    storeRef.current.getVersion,
    storeRef.current.getVersion
  );

  return storeRef.current;
}

export function useDraft(options = {}) {
  return useDraftStore(options);
}
