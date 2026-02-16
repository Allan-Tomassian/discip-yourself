import { describe, expect, it } from "vitest";
import { SUPABASE_ENV_ERROR_MESSAGE, validateSupabaseEnv } from "./supabaseClient";

describe("validateSupabaseEnv", () => {
  it("accepte URL + anon key valides", () => {
    const result = validateSupabaseEnv(
      "https://abc-123.supabase.co",
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid"
    );
    expect(result.url).toBe("https://abc-123.supabase.co");
    expect(result.anonKey).toMatch(/^ey/);
  });

  it("rejette URL placeholder", () => {
    expect(() =>
      validateSupabaseEnv("https://your-project-ref.supabase.co", "eyJ.valid")
    ).toThrow(SUPABASE_ENV_ERROR_MESSAGE);
  });

  it("rejette URL au mauvais format", () => {
    expect(() => validateSupabaseEnv("http://abc.supabase.co", "eyJ.valid")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
    expect(() => validateSupabaseEnv("https://abc.supabase.co/", "eyJ.valid")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
  });

  it("rejette anon key vide ou placeholder", () => {
    expect(() => validateSupabaseEnv("https://abc.supabase.co", "")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
    expect(() => validateSupabaseEnv("https://abc.supabase.co", "your-anon-key")).toThrow(
      SUPABASE_ENV_ERROR_MESSAGE
    );
  });
});
