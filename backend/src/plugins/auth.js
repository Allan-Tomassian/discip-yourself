import { createSupabaseAdminClient, verifySupabaseAccessToken } from "../lib/supabase.js";

function readBearerToken(headerValue) {
  const raw = String(headerValue || "").trim();
  if (!raw) return "";
  const [scheme, token] = raw.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return "";
  return String(token || "").trim();
}

export async function authPlugin(app, options = {}) {
  const config = options.config || null;
  const supabase = options.supabase || (config ? createSupabaseAdminClient(config) : null);
  const verifyAccessToken =
    options.verifyAccessToken ||
    (supabase ? async (token) => verifySupabaseAccessToken(supabase, token) : null);

  app.decorate("authenticate", async function authenticate(request, reply) {
    const accessToken = readBearerToken(request.headers.authorization);
    if (!accessToken) {
      return reply.code(401).send({
        error: "AUTH_MISSING",
        message: "Bearer token required.",
        requestId: request.requestId,
      });
    }
    if (typeof verifyAccessToken !== "function") {
      request.log.error({ requestId: request.requestId }, "auth verifier unavailable");
      return reply.code(500).send({
        error: "AUTH_UNAVAILABLE",
        message: "Auth verifier unavailable.",
        requestId: request.requestId,
      });
    }
    const user = await verifyAccessToken(accessToken, request);
    if (!user?.id) {
      return reply.code(401).send({
        error: "AUTH_INVALID",
        message: "Invalid bearer token.",
        requestId: request.requestId,
      });
    }
    request.accessToken = accessToken;
    request.user = user;
    return undefined;
  });
}
