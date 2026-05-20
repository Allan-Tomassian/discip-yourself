export function openPaywallLegalLink({ onClose, onOpen } = {}) {
  if (typeof onClose === "function") onClose();
  if (typeof onOpen === "function") onOpen();
}
