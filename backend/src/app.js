import Fastify from "fastify";
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

  await requestIdPlugin(app);
  await authPlugin(app, { config, supabase, verifyAccessToken });

  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({ ok: true });
  });

  await app.register(aiRoutes, { prefix: "/ai" });
  return app;
}
