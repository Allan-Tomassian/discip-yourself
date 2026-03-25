import { describe, expect, it } from "vitest";
import {
  parseAuthCallbackParams,
  shouldDetectSupabaseSessionInUrl,
} from "./authPaths";

describe("authPaths", () => {
  it("detecte les callbacks Supabase uniquement sur verify-email et reset-password", () => {
    expect(
      shouldDetectSupabaseSessionInUrl(
        new URL("https://app.example.com/auth/verify-email"),
        { code: "abc123" }
      )
    ).toBe(true);

    expect(
      shouldDetectSupabaseSessionInUrl(
        new URL("https://app.example.com/auth/reset-password"),
        { access_token: "token", type: "recovery" }
      )
    ).toBe(true);

    expect(
      shouldDetectSupabaseSessionInUrl(
        new URL("https://app.example.com/auth/login"),
        { access_token: "token" }
      )
    ).toBe(false);
  });

  it("fusionne query string et hash pour les callbacks Supabase", () => {
    expect(
      parseAuthCallbackParams(
        "https://app.example.com/auth/reset-password?code=abc#type=recovery&access_token=token"
      )
    ).toEqual({
      code: "abc",
      type: "recovery",
      access_token: "token",
    });
  });
});

