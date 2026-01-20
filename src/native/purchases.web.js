export const PRODUCT_IDS = {
  monthly: "com.discipyourself.premium.monthly",
  yearly: "com.discipyourself.premium.yearly",
};

export async function loadProducts() {
  return { available: false, monthly: null, yearly: null };
}

export async function purchase() {
  return { success: false };
}

export async function restore() {
  return { success: false };
}

export async function getPremiumEntitlement() {
  return { premium: false, expiresAt: null, source: "none" };
}
