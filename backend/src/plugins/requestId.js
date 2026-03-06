import { randomUUID } from "node:crypto";

export async function requestIdPlugin(app) {
  app.addHook("onRequest", async (request) => {
    const incoming = String(request.headers["x-request-id"] || "").trim();
    request.requestId = incoming || request.id || randomUUID();
  });

  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.requestId || request.id || randomUUID());
    return payload;
  });
}
