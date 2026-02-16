import { initialData } from "../../../src/logic/state.js";
import { LS_KEY } from "../../../src/utils/storage.js";
import { E2E_AUTH_SESSION_KEY } from "../../../src/auth/constants.js";
import { buildLocalUserDataKey } from "../../../src/data/userDataApi.js";
import { buildLocalProfileKey, LOCAL_PROFILE_USERNAME_MAP_KEY } from "../../../src/profile/profileApi.js";

function toDateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysKey(baseKey, days) {
  const [yyyy, mm, dd] = String(baseKey || "").split("-").map((v) => Number(v));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function buildBaseState({ withContent = false } = {}) {
  const data = initialData();
  const today = toDateKey(new Date());
  const tomorrow = addDaysKey(today, 1);
  const inTwoDays = addDaysKey(today, 2);

  data.ui.onboardingCompleted = true;
  data.ui.showPlanStep = false;
  data.ui.selectedDate = today;

  data.categories = [
    { id: "sys_inbox", name: "Général", color: "#64748B", isSystem: true },
    { id: "cat_business", name: "Business", color: "#0EA5E9" },
    { id: "cat_empty", name: "Vide", color: "#22C55E" },
  ];
  data.ui.categoryRailOrder = ["cat_business", "cat_empty", "sys_inbox"];
  data.ui.selectedCategoryId = "cat_business";
  data.ui.selectedCategoryByView = {
    home: "cat_business",
    library: "cat_business",
    plan: "cat_business",
    pilotage: "cat_business",
  };

  if (withContent) {
    data.goals = [
      {
        id: "goal_proj",
        categoryId: "cat_business",
        title: "Projet Seed",
        type: "OUTCOME",
        planType: "STATE",
        status: "active",
        startDate: today,
        deadline: inTwoDays,
        priority: "secondaire",
      },
      {
        id: "goal_action",
        categoryId: "cat_business",
        title: "Action Seed",
        type: "PROCESS",
        planType: "ONE_OFF",
        status: "active",
        oneOffDate: today,
        timeMode: "FIXED",
        startTime: "09:00",
        timeSlots: ["09:00"],
        reminderTime: "08:00",
      },
    ];
    data.habits = [
      {
        id: "habit_legacy",
        categoryId: "cat_business",
        title: "Habitude Legacy Seed",
        cadence: "WEEKLY",
        target: 1,
      },
    ];
    data.occurrences = [
      {
        id: "occ_1",
        goalId: "goal_action",
        date: today,
        start: "09:00",
        slotKey: "09:00",
        status: "planned",
      },
      {
        id: "occ_2",
        goalId: "habit_legacy",
        date: tomorrow,
        start: "00:00",
        slotKey: "00:00",
        status: "planned",
        noTime: true,
      },
    ];
    data.reminders = [
      {
        id: "rem_1",
        goalId: "goal_action",
        time: "08:00",
        windowStart: "",
        windowEnd: "",
      },
      {
        id: "rem_2",
        goalId: "habit_legacy",
        time: "12:00",
        windowStart: "",
        windowEnd: "",
      },
    ];
  }

  return data;
}

export function buildMockAuthSession({ userId = "e2e-user-id", email = "e2e@example.com" } = {}) {
  return {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    expires_at: 4_102_444_800,
    token_type: "bearer",
    user: {
      id: userId,
      email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: {},
    },
  };
}

function defaultUsernameFromUserId(userId) {
  const normalized = String(userId || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  if (normalized.length >= 3) return normalized;
  return `user${normalized}`.slice(0, 24);
}

export function buildMockProfile({ userId = "e2e-user-id", username = "", displayName = "", birthdate = "" } = {}) {
  const normalizedUsername = username || defaultUsernameFromUserId(userId);
  return {
    id: userId,
    username: normalizedUsername,
    display_name: displayName,
    birthdate: birthdate || null,
  };
}

export async function seedAuthSession(page, session = buildMockAuthSession()) {
  await page.addInitScript(
    ({ key, sessionData }) => {
      localStorage.setItem(key, JSON.stringify(sessionData));
    },
    { key: E2E_AUTH_SESSION_KEY, sessionData: session }
  );
}

export async function clearAuthSession(page) {
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
  }, E2E_AUTH_SESSION_KEY);
}

export async function seedState(page, state, options = {}) {
  const withAuth = options.withAuth !== false;
  const withProfile = options.withProfile !== false;
  const authSession = withAuth ? options.authSession || buildMockAuthSession() : null;
  const authUserId = authSession?.user?.id || "";
  const profileData = withAuth && withProfile && authUserId
    ? options.profile || buildMockProfile({ userId: authUserId, username: `u_${authUserId.replace(/[^a-zA-Z0-9]/g, "")}` })
    : null;
  const profileUsername = String(profileData?.username || "").toLowerCase();
  await page.addInitScript(
    ({ key, data, authKey, sessionData, userDataKey, profileKey, profileValue, usernamesKey, profileUsernameValue, profileUserId }) => {
      localStorage.setItem(key, JSON.stringify(data));
      if (sessionData) {
        localStorage.setItem(authKey, JSON.stringify(sessionData));
        if (userDataKey) localStorage.setItem(userDataKey, JSON.stringify(data));
        if (profileKey && profileValue) {
          localStorage.setItem(profileKey, JSON.stringify(profileValue));
          const currentMap = JSON.parse(localStorage.getItem(usernamesKey) || "{}");
          if (profileUsernameValue) currentMap[profileUsernameValue] = profileUserId;
          localStorage.setItem(usernamesKey, JSON.stringify(currentMap));
        }
      } else {
        localStorage.removeItem(authKey);
        if (userDataKey) localStorage.removeItem(userDataKey);
      }
    },
    {
      key: LS_KEY,
      data: state,
      authKey: E2E_AUTH_SESSION_KEY,
      sessionData: authSession,
      userDataKey: authUserId ? buildLocalUserDataKey(authUserId) : "",
      profileKey: authUserId ? buildLocalProfileKey(authUserId) : "",
      profileValue: profileData,
      usernamesKey: LOCAL_PROFILE_USERNAME_MAP_KEY,
      profileUsernameValue: profileUsername,
      profileUserId: authUserId,
    }
  );
}

export async function seedUserData(page, userId, data) {
  const key = buildLocalUserDataKey(userId);
  await page.addInitScript(
    ({ storageKey, payload }) => {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    },
    { storageKey: key, payload: data }
  );
}

export async function seedProfile(page, userId, profile) {
  const profileKey = buildLocalProfileKey(userId);
  const normalizedUsername = String(profile?.username || "").toLowerCase();
  await page.addInitScript(
    ({ key, value, usernamesKey, username, profileUserId }) => {
      localStorage.setItem(key, JSON.stringify(value));
      const currentMap = JSON.parse(localStorage.getItem(usernamesKey) || "{}");
      if (username) currentMap[username] = profileUserId;
      localStorage.setItem(usernamesKey, JSON.stringify(currentMap));
    },
    {
      key: profileKey,
      value: profile,
      usernamesKey: LOCAL_PROFILE_USERNAME_MAP_KEY,
      username: normalizedUsername,
      profileUserId: userId,
    }
  );
}

export async function clearProfile(page, userId) {
  const profileKey = buildLocalProfileKey(userId);
  await page.addInitScript(
    ({ key, usernamesKey, profileUserId }) => {
      const current = JSON.parse(localStorage.getItem(key) || "null");
      localStorage.removeItem(key);
      const currentMap = JSON.parse(localStorage.getItem(usernamesKey) || "{}");
      const username = String(current?.username || "").toLowerCase();
      if (username && currentMap[username] === profileUserId) {
        delete currentMap[username];
      }
      localStorage.setItem(usernamesKey, JSON.stringify(currentMap));
    },
    {
      key: profileKey,
      usernamesKey: LOCAL_PROFILE_USERNAME_MAP_KEY,
      profileUserId: userId,
    }
  );
}

export async function getUserData(page, userId) {
  const key = buildLocalUserDataKey(userId);
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

export async function getState(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, LS_KEY);
}

export function getTodayKey() {
  return toDateKey(new Date());
}

export function getDateKeyInDays(days) {
  return addDaysKey(toDateKey(new Date()), days);
}
