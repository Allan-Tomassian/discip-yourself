import { describe, expect, it } from "vitest";
import { deriveAiUnavailableMessage, isPrivateNetworkOrigin } from "./aiTransportDiagnostics";

describe("aiTransportDiagnostics", () => {
  it("reconnait une origine LAN privee", () => {
    expect(isPrivateNetworkOrigin("http://192.168.1.183:5173")).toBe(true);
    expect(isPrivateNetworkOrigin("http://10.0.0.22:4174")).toBe(true);
    expect(isPrivateNetworkOrigin("https://app.example.com")).toBe(false);
  });

  it("mappe les messages UI en offline reel", () => {
    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "NETWORK_ERROR",
          transportMeta: { probableCause: "offline" },
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("offline");
  });

  it("mappe les messages UI sur une origine privee probablement bloquee", () => {
    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "NETWORK_ERROR",
          transportMeta: { probableCause: "cors_private_origin" },
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("cors");
  });

  it("retombe sur le message reseau generique pour les autres echec reseau", () => {
    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "NETWORK_ERROR",
          transportMeta: { probableCause: "network_unknown" },
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("unknown");
  });

  it("mappe les codes d'auth explicites sur le message de session", () => {
    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "AUTH_INVALID",
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          timeout: "timeout",
          backendUnavailable: "backend",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("unauthorized");
  });

  it("mappe les indisponibilités backend et les timeouts sur des messages dédiés", () => {
    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "BACKEND_UNAVAILABLE",
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          timeout: "timeout",
          backendUnavailable: "backend",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("backend");

    expect(
      deriveAiUnavailableMessage(
        {
          errorCode: "TIMEOUT",
        },
        {
          disabled: "disabled",
          unauthorized: "unauthorized",
          rateLimited: "rate",
          timeout: "timeout",
          backendUnavailable: "backend",
          offline: "offline",
          corsPrivateOrigin: "cors",
          networkUnknown: "unknown",
          fallback: "fallback",
        }
      )
    ).toBe("timeout");
  });
});
