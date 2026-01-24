const SOURCE_NONE = "none";

const webFallback = {
  available: false,
  monthly: null,
  yearly: null,
};

function normalizeProducts(products) {
  if (!products || typeof products !== "object") return webFallback;
  const monthly = products.monthly && typeof products.monthly === "object"
    ? { trialDays: null, ...products.monthly }
    : null;
  const yearly = products.yearly && typeof products.yearly === "object"
    ? { trialDays: null, ...products.yearly }
    : null;
  return { ...products, monthly, yearly };
}

let cachedModule = null;

function isNativePlatform() {
  const flag = globalThis?.Capacitor?.isNativePlatform;
  if (typeof flag === "function") return flag.call(globalThis.Capacitor);
  return Boolean(flag);
}

async function loadModule() {
  if (cachedModule) return cachedModule;
  const modulePath = isNativePlatform()
    ? new URL("../native/purchases.ios.js", import.meta.url).href
    : new URL("../native/purchases.web.js", import.meta.url).href;
  cachedModule = import(/* @vite-ignore */ modulePath);
  return cachedModule;
}

export const PRODUCT_IDS = {
  monthly: "com.discipyourself.premium.monthly",
  yearly: "com.discipyourself.premium.yearly",
};

export async function loadProducts() {
  try {
    const mod = await loadModule();
    if (mod?.loadProducts) {
      const products = await mod.loadProducts();
      return normalizeProducts(products);
    }
  } catch (err) {
    void err;
  }
  return webFallback;
}

export async function purchase(productId) {
  try {
    const mod = await loadModule();
    if (mod?.purchase) return mod.purchase(productId);
  } catch (err) {
    void err;
  }
  return { success: false };
}

export async function restore() {
  try {
    const mod = await loadModule();
    if (mod?.restore) return mod.restore();
  } catch (err) {
    void err;
  }
  return { success: false };
}

export async function getPremiumEntitlement() {
  try {
    const mod = await loadModule();
    if (mod?.getPremiumEntitlement) return mod.getPremiumEntitlement();
  } catch (err) {
    void err;
  }
  return { premium: false, expiresAt: null, source: SOURCE_NONE };
}
