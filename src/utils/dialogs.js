function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

function restoreBodyScroll() {
  if (typeof document === "undefined") return;
  document.body.style.overflow = "";
}

function iosRepaint() {
  if (!isIOS() || typeof window === "undefined") return;
  requestAnimationFrame(() => {
    window.scrollTo(window.scrollX, window.scrollY);
    requestAnimationFrame(() => window.scrollTo(window.scrollX, window.scrollY));
  });
}

function afterDialog() {
  restoreBodyScroll();
  iosRepaint();
}

export function safePrompt(message, fallback) {
  if (typeof window === "undefined") return null;
  let res = null;
  try {
    res = window.prompt(message, fallback);
  } finally {
    afterDialog();
  }
  return res;
}

export function safeConfirm(message) {
  if (typeof window === "undefined") return false;
  let res = false;
  try {
    res = window.confirm(message);
  } finally {
    afterDialog();
  }
  return res;
}

export function safeAlert(message) {
  if (typeof window === "undefined") return;
  try {
    window.alert(message);
  } finally {
    afterDialog();
  }
}

export function markIOSRootClass() {
  if (typeof document === "undefined") return;
  if (!isIOS()) return;
  document.documentElement.classList.add("ios");
}

export { isIOS };
