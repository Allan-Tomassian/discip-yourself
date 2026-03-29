import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const app = await buildApp({
  config,
  logger: config.LOG_LEVEL === "silent" ? false : { level: config.LOG_LEVEL },
});

try {
  await app.listen({ host: "0.0.0.0", port: config.PORT });
  app.log.info({
    port: config.PORT,
    allowPrivateNetworkDev: Boolean(config.CORS_ALLOW_PRIVATE_NETWORK_DEV),
    allowedOrigins: Array.isArray(config.CORS_ALLOWED_ORIGINS) ? config.CORS_ALLOWED_ORIGINS : [],
  }, "AI backend ready");
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
