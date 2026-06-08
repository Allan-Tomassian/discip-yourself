import { clearUserScopedLocalData } from "../data/userDataApi";
import { clearJournalStorageForUser } from "../pages/journalStorageModel";
import { clearUserScopedProfile } from "../profile/profileApi";
import { clearState } from "../utils/storage";
import { E2E_AUTH_SESSION_KEY } from "./constants";

const RECOVERY_MODE_STORAGE_KEY = "discip.auth.recovery_mode";

export function clearPersistedRecoveryMode() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RECOVERY_MODE_STORAGE_KEY);
}

export function clearSignedOutLocalState(signedOutUserId = "") {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    window.localStorage.removeItem(E2E_AUTH_SESSION_KEY);
  }
  clearPersistedRecoveryMode();
  clearState();
  clearUserScopedLocalData(signedOutUserId);
  clearUserScopedProfile(signedOutUserId);
  clearJournalStorageForUser({ userId: signedOutUserId });
}
