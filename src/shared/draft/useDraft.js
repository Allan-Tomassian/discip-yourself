import { useState, useSyncExternalStore } from "react";
import { createDraftStore } from "./draftStore";

export function useDraftStore(options = {}) {
  const [store] = useState(() => createDraftStore(options));

  useSyncExternalStore(
    store.subscribe,
    store.getVersion,
    store.getVersion
  );

  return store;
}

export function useDraft(options = {}) {
  return useDraftStore(options);
}
