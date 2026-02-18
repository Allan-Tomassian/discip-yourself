import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";

export const WALLET_V1_VERSION = 1;
export const MICRO_ACTION_COINS_REWARD = 2;
export const REWARDED_AD_COINS_REWARD = 50;
export const BASIC_REWARDED_ADS_DAILY_LIMIT = 10;
export const WALLET_EVENTS_MAX = 50;

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

function toSafeDateKey(value) {
  return normalizeLocalDateKey(typeof value === "string" ? value : "") || todayLocalKey();
}

function toSafeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function sanitizeEvent(event, fallbackAmount = 0) {
  const safe = asObject(event);
  const type = typeof safe.type === "string" && safe.type.trim() ? safe.type.trim() : "micro_done";
  const amount = toSafeInt(safe.amount, toSafeInt(fallbackAmount, 0));
  const ts = Number.isFinite(safe.ts) ? safe.ts : Date.now();
  const meta = safe.meta && typeof safe.meta === "object" ? safe.meta : undefined;
  return {
    ts,
    type,
    amount,
    ...(meta ? { meta } : {}),
  };
}

function trimEvents(events) {
  const list = Array.isArray(events) ? events : [];
  if (list.length <= WALLET_EVENTS_MAX) return list;
  return list.slice(list.length - WALLET_EVENTS_MAX);
}

function normalizeWallet(rawWallet, dateKey) {
  const safeDate = toSafeDateKey(dateKey);
  const wallet = asObject(rawWallet);
  const safeEvents = Array.isArray(wallet.lastEvents)
    ? trimEvents(
        wallet.lastEvents
          .filter((event) => event && typeof event === "object")
          .map((event) => sanitizeEvent(event, event?.amount))
      )
    : [];

  return {
    version: WALLET_V1_VERSION,
    balance: toSafeInt(wallet.balance, 0),
    earnedToday: toSafeInt(wallet.earnedToday, 0),
    adsToday: toSafeInt(wallet.adsToday, 0),
    dateKey: toSafeDateKey(wallet.dateKey || safeDate),
    lastEvents: safeEvents,
  };
}

function appendEventUnsafe(wallet, event, fallbackAmount = 0) {
  const safeWallet = asObject(wallet);
  const nextEvent = sanitizeEvent(event, fallbackAmount);
  return {
    ...safeWallet,
    lastEvents: trimEvents([...(Array.isArray(safeWallet.lastEvents) ? safeWallet.lastEvents : []), nextEvent]),
  };
}

export function resetIfNewDay(wallet, dateKey = todayLocalKey()) {
  const safeDate = toSafeDateKey(dateKey);
  const normalized = normalizeWallet(wallet, safeDate);
  if (normalized.dateKey === safeDate) return normalized;
  return {
    ...normalized,
    dateKey: safeDate,
    earnedToday: 0,
    adsToday: 0,
  };
}

export function ensureWallet(state, options = {}) {
  const safeState = asObject(state);
  const safeUi = asObject(safeState.ui);
  const dateKey = toSafeDateKey(options.dateKey || todayLocalKey());
  const normalized = normalizeWallet(safeUi.walletV1, dateKey);
  return resetIfNewDay(normalized, dateKey);
}

export function appendWalletEvent(wallet, event, options = {}) {
  const safeDate = toSafeDateKey(options.dateKey || todayLocalKey());
  const normalized = resetIfNewDay(normalizeWallet(wallet, safeDate), safeDate);
  return appendEventUnsafe(normalized, event, event?.amount || 0);
}

export function addCoins(wallet, amount, event = {}, options = {}) {
  const safeDate = toSafeDateKey(options.dateKey || todayLocalKey());
  const normalized = resetIfNewDay(normalizeWallet(wallet, safeDate), safeDate);
  const safeAmount = toSafeInt(amount, 0);
  if (!safeAmount) return normalized;

  const updated = {
    ...normalized,
    balance: normalized.balance + safeAmount,
    earnedToday: normalized.earnedToday + safeAmount,
  };

  return appendEventUnsafe(
    updated,
    {
      ...event,
      amount: safeAmount,
    },
    safeAmount
  );
}

export function spendCoins(wallet, amount, event = {}, options = {}) {
  const safeDate = toSafeDateKey(options.dateKey || todayLocalKey());
  const normalized = resetIfNewDay(normalizeWallet(wallet, safeDate), safeDate);
  const safeAmount = toSafeInt(amount, 0);
  if (!safeAmount) return { wallet: normalized, spent: false };
  if (normalized.balance < safeAmount) return { wallet: normalized, spent: false };

  const updated = {
    ...normalized,
    balance: normalized.balance - safeAmount,
  };

  const nextWallet = appendEventUnsafe(
    updated,
    {
      ...event,
      amount: safeAmount,
    },
    safeAmount
  );

  return { wallet: nextWallet, spent: true };
}

export function canWatchAd(wallet, options = {}) {
  const limit = Number.isFinite(options.limit)
    ? Math.max(0, Math.floor(options.limit))
    : BASIC_REWARDED_ADS_DAILY_LIMIT;
  if (!Number.isFinite(limit)) return true;
  const normalized = resetIfNewDay(normalizeWallet(wallet, options.dateKey || todayLocalKey()), options.dateKey || todayLocalKey());
  return normalized.adsToday < limit;
}

export function applyAdReward(wallet, options = {}) {
  const safeDate = toSafeDateKey(options.dateKey || todayLocalKey());
  const normalized = resetIfNewDay(normalizeWallet(wallet, safeDate), safeDate);
  if (!canWatchAd(normalized, { dateKey: safeDate, limit: options.limit })) {
    return { wallet: normalized, granted: false };
  }

  const coins = toSafeInt(options.coins, REWARDED_AD_COINS_REWARD);
  const rewarded = addCoins(
    normalized,
    coins,
    {
      type: "ad_reward",
      meta: options.meta,
    },
    { dateKey: safeDate }
  );

  return {
    wallet: {
      ...rewarded,
      adsToday: rewarded.adsToday + 1,
    },
    granted: true,
  };
}
