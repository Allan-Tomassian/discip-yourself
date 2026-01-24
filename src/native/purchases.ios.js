import { Capacitor } from "@capacitor/core";
import { Purchases } from "@capawesome-team/capacitor-purchases";

export const PRODUCT_IDS = {
  monthly: "com.discipyourself.premium.monthly",
  yearly: "com.discipyourself.premium.yearly",
};

const SOURCE_NONE = "none";
const SOURCE_STORE = "storekit";

function safeProductId(product) {
  if (!product || typeof product !== "object") return "";
  return product.productId || product.id || product.identifier || "";
}

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseIsoTrialPeriod(raw) {
  if (typeof raw !== "string") return null;
  const match = raw.trim().toUpperCase().match(/^P(\d+)(D|W)$/);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return null;
  const unit = match[2];
  if (unit === "D") return count;
  if (unit === "W") return count * 7;
  return null;
}

function normalizePeriod(period) {
  if (!period) return null;
  if (typeof period === "string") {
    const isoDays = parseIsoTrialPeriod(period);
    if (isoDays) return { unit: "DAY", value: isoDays };
    return null;
  }
  if (typeof period !== "object") return null;
  const unitRaw = period.unit || period.unitType || period.periodUnit || period.type || "";
  const valueRaw =
    period.value ?? period.numberOfUnits ?? period.unitCount ?? period.count ?? null;
  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(unitRaw || "").toUpperCase();
  if (!unit) return null;
  return { unit, value };
}

function periodToTrialDays(period) {
  if (!period) return null;
  const unit = String(period.unit || "").toUpperCase();
  const value = Number(period.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "DAY" || unit === "DAYS") return value;
  if (unit === "WEEK" || unit === "WEEKS") return value * 7;
  return null;
}

function resolveTrialDays(product) {
  if (!product || typeof product !== "object") return null;
  if (Number.isFinite(product.trialDays) && product.trialDays > 0) return product.trialDays;
  const candidates = [
    product.introductoryOfferPeriod,
    product.introductoryOffer?.period,
    product.introductoryOffer?.subscriptionPeriod,
    product.introductoryPrice?.period,
    product.introductoryPrice?.subscriptionPeriod,
    product.introductoryPricePeriod,
    product.introductoryPeriod,
    product.trialPeriod,
    product.freeTrialPeriod,
    product.introductoryTrialPeriod,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      const isoDays = parseIsoTrialPeriod(candidate);
      if (isoDays) return isoDays;
      continue;
    }
    const normalized = normalizePeriod(candidate);
    const days = periodToTrialDays(normalized);
    if (Number.isFinite(days) && days > 0) return days;
  }
  return null;
}

function normalizeProduct(product) {
  if (!product || typeof product !== "object") return null;
  const priceValue =
    toNumber(product.price) ||
    toNumber(product.amount) ||
    toNumber(product.priceValue) ||
    null;
  return {
    id: safeProductId(product),
    title: product.title || product.displayName || product.name || "",
    description: product.description || "",
    price: priceValue,
    priceString: product.priceString || product.displayPrice || product.localizedPrice || "",
    currency: product.currencyCode || product.currency || "",
    period: product.subscriptionPeriod || product.period || "",
    trialDays: resolveTrialDays(product),
  };
}

async function isStoreAvailable() {
  if (!Capacitor.isNativePlatform()) return false;
  if (!Purchases || typeof Purchases.isAvailable !== "function") return false;
  try {
    const result = await Purchases.isAvailable();
    return Boolean(result?.available);
  } catch (err) {
    void err;
    return false;
  }
}

async function fetchProductById(productId) {
  if (!productId) return null;
  if (!Purchases || typeof Purchases.getProductById !== "function") return null;
  try {
    const result = await Purchases.getProductById({ productId });
    const product = result?.product || result;
    return normalizeProduct(product);
  } catch (err) {
    void err;
    return null;
  }
}

function resolveExpiry(transaction) {
  if (!transaction || typeof transaction !== "object") return null;
  const raw =
    transaction.expirationDate ||
    transaction.expiresDate ||
    transaction.expiresAt ||
    transaction.expires ||
    null;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isTransactionActive(transaction) {
  if (!transaction || typeof transaction !== "object") return false;
  if (typeof transaction.isActive === "boolean") return transaction.isActive;
  const expiry = resolveExpiry(transaction);
  if (!expiry) return false;
  return new Date(expiry).getTime() > Date.now();
}

function isPremiumTransaction(transaction) {
  const productId = safeProductId(transaction);
  return productId === PRODUCT_IDS.monthly || productId === PRODUCT_IDS.yearly;
}

export async function loadProducts() {
  const available = await isStoreAvailable();
  if (!available) return { available: false, monthly: null, yearly: null };
  const [monthly, yearly] = await Promise.all([
    fetchProductById(PRODUCT_IDS.monthly),
    fetchProductById(PRODUCT_IDS.yearly),
  ]);
  return { available: true, monthly, yearly };
}

export async function purchase(productId) {
  const available = await isStoreAvailable();
  if (!available || !productId) return { success: false };
  if (!Purchases || typeof Purchases.purchaseProduct !== "function") return { success: false };
  try {
    const result = await Purchases.purchaseProduct({ productId });
    return { success: true, result };
  } catch (err) {
    void err;
    return { success: false };
  }
}

export async function restore() {
  const available = await isStoreAvailable();
  if (!available) return { success: false };
  if (!Purchases || typeof Purchases.syncTransactions !== "function") return { success: false };
  try {
    await Purchases.syncTransactions();
    return { success: true };
  } catch (err) {
    void err;
    return { success: false };
  }
}

export async function getPremiumEntitlement() {
  const available = await isStoreAvailable();
  if (!available || !Purchases || typeof Purchases.getCurrentTransactions !== "function") {
    return { premium: false, expiresAt: null, source: SOURCE_NONE };
  }
  try {
    const result = await Purchases.getCurrentTransactions();
    const transactions = Array.isArray(result?.transactions) ? result.transactions : [];
    const relevant = transactions.filter((t) => isPremiumTransaction(t));
    if (!relevant.length) {
      return { premium: false, expiresAt: null, source: SOURCE_STORE };
    }
    const active = relevant.filter((t) => isTransactionActive(t));
    const target = (active.length ? active : relevant)[0];
    const expiresAt = resolveExpiry(target);
    const premium = active.length > 0 || Boolean(expiresAt);
    return { premium, expiresAt: expiresAt || null, source: SOURCE_STORE };
  } catch (err) {
    void err;
    return { premium: false, expiresAt: null, source: SOURCE_NONE };
  }
}
