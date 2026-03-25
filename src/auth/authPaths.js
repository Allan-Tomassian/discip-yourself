export const AUTH_SIGNUP_PATH = "/auth/signup";
export const AUTH_LOGIN_PATH = "/auth/login";
export const AUTH_VERIFY_EMAIL_PATH = "/auth/verify-email";
export const AUTH_FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";
const SUPABASE_CALLBACK_PATHS = new Set([AUTH_VERIFY_EMAIL_PATH, AUTH_RESET_PASSWORD_PATH]);

const AUTH_SCREEN_BY_PATH = {
  [AUTH_SIGNUP_PATH]: "signup",
  [AUTH_LOGIN_PATH]: "login",
  [AUTH_VERIFY_EMAIL_PATH]: "verify-email",
  [AUTH_FORGOT_PASSWORD_PATH]: "forgot-password",
  [AUTH_RESET_PASSWORD_PATH]: "reset-password",
};

function parseParamString(value) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return {};
  const normalized = safeValue.startsWith("#") ? safeValue.slice(1) : safeValue;
  const params = new URLSearchParams(normalized);
  return Object.fromEntries(params.entries());
}

export function normalizePathname(value) {
  const pathname = String(value || "").trim() || "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getAuthScreenFromPath(pathname) {
  return AUTH_SCREEN_BY_PATH[normalizePathname(pathname)] || "";
}

export function isAuthPathname(pathname) {
  return Boolean(getAuthScreenFromPath(pathname));
}

export function buildAuthPath(screen) {
  const entry = Object.entries(AUTH_SCREEN_BY_PATH).find(([, value]) => value === screen);
  return entry?.[0] || AUTH_SIGNUP_PATH;
}

export function parseAuthCallbackParams(input) {
  const url =
    input instanceof URL
      ? input
      : new URL(String(input || "http://localhost/"), "http://localhost");
  return {
    ...parseParamString(url.search),
    ...parseParamString(url.hash),
  };
}

export function shouldDetectSupabaseSessionInUrl(url, params = {}) {
  const safeUrl =
    url instanceof URL
      ? url
      : new URL(String(url || "http://localhost/"), "http://localhost");
  if (!SUPABASE_CALLBACK_PATHS.has(normalizePathname(safeUrl.pathname))) return false;
  const safeParams = params && typeof params === "object" ? params : {};
  return Boolean(
    safeParams.access_token ||
      safeParams.refresh_token ||
      safeParams.code ||
      safeParams.error ||
      safeParams.error_description
  );
}

export function getSearchParam(search, key) {
  const params = new URLSearchParams(String(search || ""));
  return String(params.get(key) || "").trim();
}

export function buildAuthRedirectUrl(pathname) {
  const targetPath = normalizePathname(pathname || AUTH_VERIFY_EMAIL_PATH);
  if (typeof window === "undefined" || !window.location?.origin) return targetPath;
  return new URL(targetPath, window.location.origin).toString();
}
