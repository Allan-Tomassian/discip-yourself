import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { loadLocalEnvFiles } from "./localEnv.js";

function printConfigErrorAndExit(error) {
  // eslint-disable-next-line no-console
  console.error("[env] Backend startup aborted.", error?.message || "Backend env invalid.");
  if (Array.isArray(error?.details)) {
    for (const detail of error.details) {
      const name = String(detail?.name || "").trim();
      const message = String(detail?.message || "").trim();
      if (!name || !message) continue;
      // eslint-disable-next-line no-console
      console.error(`- ${name}: ${message}`);
    }
  }
  process.exit(1);
}

loadLocalEnvFiles();

let config;
try {
  config = loadConfig(process.env);
} catch (error) {
  printConfigErrorAndExit(error);
}

const app = await buildApp({
  config,
  logger: config.LOG_LEVEL === "silent" ? false : { level: config.LOG_LEVEL },
});

try {
  await app.listen({ host: "0.0.0.0", port: config.PORT });
  const allowPrivateNetworkDev =
    Boolean(config.CORS_ALLOW_PRIVATE_NETWORK_DEV) &&
    (config.APP_ENV === "local" || config.APP_ENV === "test");
  app.log.info({
    appEnv: config.APP_ENV,
    port: config.PORT,
    openAiConfigured: Boolean(String(config.OPENAI_API_KEY || "").trim()),
    openAiDefaultTimeoutMs: config.OPENAI_DEFAULT_TIMEOUT_MS,
    allowPrivateNetworkDev,
    allowedOrigins: Array.isArray(config.CORS_ALLOWED_ORIGINS) ? config.CORS_ALLOWED_ORIGINS : [],
  }, "AI backend ready");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
