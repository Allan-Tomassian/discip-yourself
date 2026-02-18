const listeners = new Set();

export function emitTotemEvent(event) {
  if (!event || typeof event !== "object") return;
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      void error;
    }
  });
}

export function onTotemEvent(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
