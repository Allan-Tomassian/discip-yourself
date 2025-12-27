export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export async function readFileAsDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
