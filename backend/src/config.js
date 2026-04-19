import { z } from "zod";

export const BACKEND_ENV_HELP_MESSAGE =
  "Fill backend/.env.local with SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY). OPENAI_API_KEY stays server-only and is optional unless AI features are enabled.";

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

function isPlaceholderValue(raw) {
  const value = String(raw || "").trim();
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.includes("<") ||
    lower.includes(">") ||
    lower.startsWith("your-") ||
    lower.startsWith("example") ||
    lower.includes("example-project-ref") ||
    lower.includes("placeholder") ||
    lower.includes("replace") ||
    lower.includes("changeme") ||
    lower.includes("server-only")
  );
}

function uniqueEnvNamesFromIssues(issues = []) {
  return Array.from(
    new Set(
      issues
        .map((issue) => String(issue?.path?.[0] || "").trim())
        .filter(Boolean)
        .map((name) => (name === "SUPABASE_SECRET_KEY" ? "SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY" : name))
    )
  );
}

export function formatConfigValidationError(zodError) {
  const names = uniqueEnvNamesFromIssues(zodError?.issues || []);
  const invalidPart = names.length ? ` Invalid vars: ${names.join(", ")}.` : "";
  return `Backend env invalid.${invalidPart} ${BACKEND_ENV_HELP_MESSAGE}`;
}

const envSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "prod", "test"]).default("local"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SUPABASE_URL: z
    .string()
    .url()
    .refine((value) => !isPlaceholderValue(value), "SUPABASE_URL must be a real project URL."),
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((value) => !isPlaceholderValue(value), "SUPABASE_SECRET_KEY must not be a placeholder."),
  OPENAI_API_KEY: z
    .string()
    .optional()
    .default("")
    .refine((value) => !value || !isPlaceholderValue(value), "OPENAI_API_KEY must be empty or a real server-only key."),
  OPENAI_MODEL: z.string().optional().default("gpt-4.1-mini"),
  OPENAI_DEFAULT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(90000).optional().default(20000),
  FIRST_RUN_PLAN_OPENAI_MODEL: z.string().optional().default(""),
  FIRST_RUN_PLAN_OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(90000).optional().default(45000),
  SESSION_GUIDANCE_PREPARE_OPENAI_MODEL: z.string().optional().default(""),
  SESSION_GUIDANCE_PREPARE_OPENAI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).optional().default(60000),
  AI_QUOTA_MODE: z.enum(["normal", "dev_relaxed"]).default("normal"),
  CORS_ALLOW_PRIVATE_NETWORK_DEV: z.union([z.string(), z.boolean()]).optional().default("false").transform(parseBooleanFlag),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default("http://localhost:5173,http://127.0.0.1:5173")
    .transform(parseAllowedOrigins),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

function normalizeServerEnv(source = {}) {
  const env = source && typeof source === "object" ? source : {};
  return {
    ...env,
    SUPABASE_SECRET_KEY: String(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}

export function loadConfig(env = process.env) {
  const result = envSchema.safeParse(normalizeServerEnv(env));
  if (result.success) return result.data;

  const error = new Error(formatConfigValidationError(result.error));
  error.code = "BACKEND_ENV_INVALID";
  error.details = result.error.issues.map((issue) => ({
    name: String(issue?.path?.[0] || "").trim(),
    message: String(issue?.message || "").trim(),
  }));
  throw error;
}
