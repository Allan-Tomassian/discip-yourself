import Fastify from "fastify";
import cors from "@fastify/cors";
import { createSupabaseAdminClient } from "./lib/supabase.js";
import { createOpenAIClient } from "./lib/openai.js";
import { requestIdPlugin } from "./plugins/requestId.js";
import { authPlugin } from "./plugins/auth.js";
import { aiRoutes } from "./routes/ai.js";

function isPrivateIpv4Hostname(hostname) {
  const value = String(hostname || "").trim();
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

function isPrivateNetworkDevOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && isPrivateIpv4Hostname(url.hostname);
  } catch {
    return false;
  }
}

export async function buildApp({ config, logger = false, verifyAccessToken } = {}) {
  const app = Fastify({
    logger,
    bodyLimit: 16 * 1024,
  });

  const supabase = config ? createSupabaseAdminClient(config) : null;
  const openai = config ? createOpenAIClient(config) : null;

  app.decorate("config", config || null);
  app.decorate("supabase", supabase);
  app.decorate("openai", openai);

  const allowedOrigins = Array.isArray(config?.CORS_ALLOWED_ORIGINS) ? config.CORS_ALLOWED_ORIGINS : [];
  const allowPrivateNetworkDev = Boolean(config?.CORS_ALLOW_PRIVATE_NETWORK_DEV);
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed =
        allowedOrigins.includes(origin) || (allowPrivateNetworkDev && isPrivateNetworkDevOrigin(origin));
      callback(null, allowed);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  });

  await requestIdPlugin(app);
  await authPlugin(app, { config, supabase, verifyAccessToken });

  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });

  await app.register(aiRoutes, { prefix: "/ai" });
  return app;
}
