import Fastify from "fastify";
import cors from "@fastify/cors";
import { createSupabaseAdminClient } from "./lib/supabase.js";
import { createOpenAIClient } from "./lib/openai.js";
import { requestIdPlugin } from "./plugins/requestId.js";
import { authPlugin } from "./plugins/auth.js";
import { aiRoutes } from "./routes/ai.js";

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
  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.includes(origin));
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
