import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export const DEV_API_PROXY_PREFIX = "/api"
export const DEFAULT_DEV_API_PROXY_TARGET = "https://discip-yourself-backend.onrender.com"

function normalizeProxyTarget(rawValue) {
  const value = String(rawValue || "").trim()
  if (!value) return ""
  try {
    const url = new URL(value)
    if (!/^https?:$/.test(url.protocol)) return ""
    return url.toString().replace(/\/+$/, "")
  } catch {
    return ""
  }
}

export function resolveDevApiProxyTarget(env = {}) {
  return normalizeProxyTarget(env.VITE_DEV_API_PROXY_TARGET)
    || normalizeProxyTarget(env.VITE_AI_BACKEND_URL)
    || DEFAULT_DEV_API_PROXY_TARGET
}

export function rewriteDevApiProxyPath(path) {
  const rewritten = String(path || "").replace(/^\/api(?=\/|$)/, "") || "/"
  return rewritten.startsWith("/") ? rewritten : `/${rewritten}`
}

export function stripDevApiProxyOriginHeader(proxyReq) {
  if (!proxyReq || typeof proxyReq !== "object") return
  if (typeof proxyReq.removeHeader === "function") {
    proxyReq.removeHeader("origin")
    proxyReq.removeHeader("Origin")
    return
  }
  if (proxyReq.headers && typeof proxyReq.headers === "object") {
    delete proxyReq.headers.origin
    delete proxyReq.headers.Origin
  }
}

export function createDevApiProxyOptions(env = {}) {
  const target = resolveDevApiProxyTarget(env)
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: rewriteDevApiProxyPath,
    configure(proxy) {
      proxy.on("proxyReq", (proxyReq) => {
        stripDevApiProxyOriginHeader(proxyReq)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      proxy: {
        [DEV_API_PROXY_PREFIX]: createDevApiProxyOptions(env),
      },
    },
    preview: {
      port: 4174,
      strictPort: true,
    },
    test: {
      environment: "node",
    },
  }
})
