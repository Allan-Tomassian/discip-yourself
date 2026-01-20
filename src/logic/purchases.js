const SOURCE_NONE = "none";

const webFallback = {
  available: false,
  monthly: null,
  yearly: null,
};

let cachedModule = null;

function isNativePlatform() {
  return Boolean(globalThis?.Capacitor?.isNativePlatform);
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
    if (mod?.loadProducts) return mod.loadProducts();
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
