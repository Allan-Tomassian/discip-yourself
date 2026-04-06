import test from "node:test";
import assert from "node:assert/strict";
import { runChatCoach } from "../src/services/coach/chatCoach.js";

function createChatContext(overrides = {}) {
  return {
    requestId: "req-chat-1",
    activeDate: "2026-03-06",
    activeCategoryId: "cat-1",
    quotaRemaining: 3,
    messagePreview: "Clarifie mon prochain pas",
    chatMode: "free",
    coachBehavior: {
      mode: "clarity",
      overlays: ["choice_narrowing"],
      horizon: "today",
      intensity: "standard",
    },
    locale: "fr-FR",
    useCase: "general",
    message: "Clarifie mon prochain pas",
    recentMessages: [{ role: "assistant", content: "On repart d'un point simple." }],
    planningSummary: null,
    pilotageSummary: null,
    category: null,
    activeCategoryProfileSummary: null,
    relatedCategoryProfileSummaries: [],
    userAiProfile: null,
    ...overrides,
  };
}

function createLoggerRecorder() {
  const entries = [];
  return {
    entries,
    logger: {
      info(payload, message) {
        entries.push({ level: "info", payload, message });
      },
      warn(payload, message) {
        entries.push({ level: "warn", payload, message });
      },
      error(payload, message) {
        entries.push({ level: "error", payload, message });
      },
    },
  };
}

test("runChatCoach logs the AI resolution path explicitly", async () => {
  const { entries, logger } = createLoggerRecorder();
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: {
                    kind: "conversation",
                    mode: "free",
                    message: "Commence par un seul pas concret aujourd’hui.",
                    primaryAction: null,
                    secondaryAction: null,
                    proposal: null,
                  },
                },
              },
            ],
          }),
        },
      },
    },
    log: logger,
  };

  const payload = await runChatCoach({
    app,
    context: createChatContext(),
  });

  assert.equal(payload.decisionSource, "ai");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "info");
  assert.equal(entries[0].message, "Chat coach resolved with AI");
  assert.equal(entries[0].payload.decisionSource, "ai");
  assert.equal(entries[0].payload.fallbackReason, "none");
  assert.equal(entries[0].payload.hasOpenAiKey, true);
  assert.equal(entries[0].payload.hasOpenAiClient, true);
  assert.equal(entries[0].payload.behaviorMode, "clarity");
  assert.deepEqual(entries[0].payload.behaviorOverlays, ["choice_narrowing"]);
  assert.equal(entries[0].payload.behaviorHorizon, "today");
  assert.equal(entries[0].payload.behaviorIntensity, "standard");
});

test("runChatCoach logs openai_key_missing when chat falls back without a key", async () => {
  const { entries, logger } = createLoggerRecorder();
  const app = {
    config: {
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: null,
    log: logger,
  };

  const payload = await runChatCoach({
    app,
    context: createChatContext(),
  });

  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.fallbackReason, "none");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[0].message, "Chat coach resolved with rules fallback");
  assert.equal(entries[0].payload.rulesReason, "openai_key_missing");
  assert.equal(entries[0].payload.fallbackReason, "none");
  assert.equal(entries[0].payload.hasOpenAiKey, false);
  assert.equal(entries[0].payload.hasOpenAiClient, false);
  assert.equal(entries[0].payload.behaviorMode, "clarity");
  assert.deepEqual(entries[0].payload.behaviorOverlays, ["choice_narrowing"]);
  assert.equal(entries[0].payload.behaviorHorizon, "today");
  assert.equal(entries[0].payload.behaviorIntensity, "standard");
});

test("runChatCoach logs invalid_model_output with issueCode when model output is rejected", async () => {
  const { entries, logger } = createLoggerRecorder();
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => ({
            choices: [
              {
                message: {
                  parsed: null,
                },
              },
            ],
          }),
        },
      },
    },
    log: logger,
  };

  const payload = await runChatCoach({
    app,
    context: createChatContext(),
  });

  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.fallbackReason, "invalid_model_output");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "warn");
  assert.equal(entries[0].message, "Chat coach resolved with rules fallback");
  assert.equal(entries[0].payload.rulesReason, "invalid_model_output");
  assert.equal(entries[0].payload.issueCode, "missing_parsed_payload");
  assert.equal(entries[0].payload.hasOpenAiKey, true);
  assert.equal(entries[0].payload.hasOpenAiClient, true);
});

test("runChatCoach logs openai_backend_error when the OpenAI client fails", async () => {
  const { entries, logger } = createLoggerRecorder();
  const app = {
    config: {
      OPENAI_API_KEY: "test-openai-key",
      OPENAI_MODEL: "gpt-4.1-mini",
    },
    openai: {
      chat: {
        completions: {
          parse: async () => {
            throw new Error("upstream boom");
          },
        },
      },
    },
    log: logger,
  };

  const payload = await runChatCoach({
    app,
    context: createChatContext(),
  });

  assert.equal(payload.decisionSource, "rules");
  assert.equal(payload.meta.fallbackReason, "backend_error");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].level, "error");
  assert.equal(entries[0].message, "Chat coach resolved with rules fallback");
  assert.equal(entries[0].payload.rulesReason, "openai_backend_error");
  assert.match(String(entries[0].payload.err?.message || ""), /upstream boom/);
  assert.equal(entries[0].payload.hasOpenAiKey, true);
  assert.equal(entries[0].payload.hasOpenAiClient, true);
});
