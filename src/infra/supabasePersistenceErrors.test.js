import { describe, expect, it } from "vitest";
import {
  canUseLocalPersistenceFallback,
  isSupabaseSchemaError,
  mapProfilePersistenceError,
  mapUserDataPersistenceError,
} from "./supabasePersistenceErrors";

describe("supabasePersistenceErrors", () => {
  it("detects schema drift errors", () => {
    expect(isSupabaseSchemaError({ code: "PGRST205", message: "Could not find the table 'public.user_data' in the schema cache" })).toBe(true);
  });

  it("maps profile schema errors to a technical actionable message", () => {
    const error = mapProfilePersistenceError({
      code: "PGRST205",
      message: "Could not find the table 'public.profiles' in the schema cache",
    });
    expect(error.code).toBe("PROFILE_SCHEMA");
    expect(error.message).toContain("migrations");
  });

  it("keeps local fallback only for transient network errors", () => {
    const networkError = mapUserDataPersistenceError({ message: "Failed to fetch" });
    const schemaError = mapUserDataPersistenceError({
      code: "PGRST205",
      message: "Could not find the table 'public.user_data' in the schema cache",
    });

    expect(canUseLocalPersistenceFallback(networkError)).toBe(true);
    expect(canUseLocalPersistenceFallback(schemaError)).toBe(false);
  });
});
