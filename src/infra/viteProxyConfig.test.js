import { describe, expect, it, vi } from "vitest";
import viteConfig, {
  DEV_API_PROXY_PREFIX,
  createDevApiProxyOptions,
  resolveDevApiProxyTarget,
  rewriteDevApiProxyPath,
  stripDevApiProxyOriginHeader,
} from "../../vite.config";

describe("Vite backend proxy config", () => {
  it("configures only the /api proxy prefix", async () => {
    const config = await viteConfig({ mode: "development", command: "serve" });

    expect(Object.keys(config.server.proxy)).toEqual([DEV_API_PROXY_PREFIX]);
  });

  it("resolves the proxy target from development env", () => {
    expect(
      resolveDevApiProxyTarget({
        VITE_DEV_API_PROXY_TARGET: "https://discip-yourself-backend.onrender.com/",
      }),
    ).toBe("https://discip-yourself-backend.onrender.com");
  });

  it("rewrites only the leading /api prefix and preserves query parameters", () => {
    expect(rewriteDevApiProxyPath("/api/health")).toBe("/health");
    expect(rewriteDevApiProxyPath("/api/ai/session-guidance?debug=1")).toBe("/ai/session-guidance?debug=1");
    expect(rewriteDevApiProxyPath("/api")).toBe("/");
  });

  it("does not define proxy behavior for Supabase or other frontend routes", () => {
    const options = createDevApiProxyOptions({
      VITE_DEV_API_PROXY_TARGET: "https://discip-yourself-backend.onrender.com",
    });

    expect(DEV_API_PROXY_PREFIX).toBe("/api");
    expect(rewriteDevApiProxyPath("/supabase/rest/v1/items")).toBe("/supabase/rest/v1/items");
    expect(options.target).toBe("https://discip-yourself-backend.onrender.com");
  });

  it("removes only the changing browser Origin header before proxying", () => {
    const proxyReq = {
      headers: {
        origin: "http://192.168.1.183:5173",
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      removeHeader(name) {
        delete this.headers[name.toLowerCase()];
        delete this.headers[name];
      },
    };

    stripDevApiProxyOriginHeader(proxyReq);

    expect(proxyReq.headers.origin).toBeUndefined();
    expect(proxyReq.headers.authorization).toBe("Bearer token");
    expect(proxyReq.headers["content-type"]).toBe("application/json");
  });

  it("wires proxyReq handling without changing auth or JSON request headers", () => {
    const options = createDevApiProxyOptions({
      VITE_DEV_API_PROXY_TARGET: "https://discip-yourself-backend.onrender.com",
    });
    let handler = null;
    const proxy = {
      on: vi.fn((event, callback) => {
        if (event === "proxyReq") handler = callback;
      }),
    };
    const proxyReq = {
      headers: {
        origin: "http://192.168.1.183:5173",
        authorization: "Bearer token",
        "content-type": "application/json",
      },
      removeHeader(name) {
        delete this.headers[name.toLowerCase()];
        delete this.headers[name];
      },
    };

    options.configure(proxy);
    handler(proxyReq);

    expect(proxy.on).toHaveBeenCalledWith("proxyReq", expect.any(Function));
    expect(proxyReq.headers).toEqual({
      authorization: "Bearer token",
      "content-type": "application/json",
    });
  });
});
