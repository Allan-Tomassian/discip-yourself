export const LS_KEY = "discip_yourself_v2";

export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    void err;
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (err) {
    void err;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch (err) {
    void err;
  }
}
