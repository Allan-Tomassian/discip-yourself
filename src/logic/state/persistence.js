import { loadState, saveState } from "../../utils/storage";
import { DEMO_MODE, demoData, initialData } from "./normalizers";
import { migrate } from "./migrations";
import { assertStateInvariants } from "./invariants";

function isDemoMode() {
  if (DEMO_MODE) return true;
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "1";
  } catch (err) {
    void err;
    return false;
  }
}
export function usePersistedState(React) {
  const { useEffect, useState } = React;
  const demoMode = isDemoMode();
  const [data, setData] = useState(() => {
    if (demoMode) return migrate(demoData());
    return migrate(loadState() || initialData());
  });
  useEffect(() => {
    if (demoMode) return;
    saveState(data);
  }, [data, demoMode]);
  useEffect(() => {
    assertStateInvariants(data);
  }, [data]);
  return [data, setData];
}
