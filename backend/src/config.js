import { z } from "zod";

function parseAllowedOrigins(raw) {
  const source = typeof raw === "string" ? raw : "";
  const entries = source
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return Array.from(new Set(entries));
}

function parseBooleanFlag(raw) {
  if (typeof raw === "boolean") return raw;
  const value = String(raw || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4.1-mini"),
  AI_QUOTA_MODE: z.enum(["normal", "dev_relaxed"]).default("normal"),
  CORS_ALLOW_PRIVATE_NETWORK_DEV: z.union([z.string(), z.boolean()]).optional().default("false").transform(parseBooleanFlag),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform(parseAllowedOrigins),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export function loadConfig(env = process.env) {
  return envSchema.parse(env);
}
