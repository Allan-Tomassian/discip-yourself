import { describe, expect, it } from "vitest";
import {
  SUPABASE_ENV_ERROR_MESSAGE,
  getSupabaseProjectRef,
  validateSupabaseEnv,
} from "./supabaseClient";

describe("validateSupabaseEnv", () => {
  it("URL valide -> projectRef correct", () => {
    expect(getSupabaseProjectRef("https://humfatlgvwafmbohrdip.supabase.co")).toBe("humfatlgvwafmbohrdip");
  });

  it("placeholder url -> throw", () => {
    expect(() => getSupabaseProjectRef("https://your-project-ref.supabase.co")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
  });

  it("clé sb_publishable -> ok", () => {
    const result = validateSupabaseEnv(
      "https://abc-123.supabase.co",
      "sb_publishable_cMFKXWcEkV-hHLP3l8oZew_Un0pNQ4a"
    );
    expect(result.url).toBe("https://abc-123.supabase.co");
    expect(result.anonKey).toMatch(/^sb_publishable_/);
  });

  it("clé JWT -> ok", () => {
    const result = validateSupabaseEnv(
      "https://abc-123.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid"
    );
    expect(result.url).toBe("https://abc-123.supabase.co");
    expect(result.anonKey).toMatch(/^eyJ/);
  });

  it("clé invalide -> throw", () => {
    expect(() => validateSupabaseEnv("https://abc.supabase.co", "invalid-key")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
  });
});
