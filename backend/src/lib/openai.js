import OpenAI from "openai";

export function createOpenAIClient(config) {
  const apiKey = String(config.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  const timeoutMs = Number.isFinite(config?.OPENAI_DEFAULT_TIMEOUT_MS)
    ? Math.max(1000, Math.round(config.OPENAI_DEFAULT_TIMEOUT_MS))
    : 20000;
  return new OpenAI({
    apiKey,
    timeout: timeoutMs,
    maxRetries: 0,
  });
}
