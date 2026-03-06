import OpenAI from "openai";

export function createOpenAIClient(config) {
  const apiKey = String(config.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    timeout: 4000,
    maxRetries: 0,
  });
}
