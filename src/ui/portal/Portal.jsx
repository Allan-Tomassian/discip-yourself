import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const DEFAULT_PORTAL_ID = "app-portal-root";

function getOrCreatePortalRoot(id) {
  if (typeof document === "undefined") return null;
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("div");
    node.id = id;
    node.setAttribute("data-portal-root", "true");
    document.body.appendChild(node);
  }
  return node;
}

export function usePortalRoot(id = DEFAULT_PORTAL_ID) {
  const [root, setRoot] = useState(() => getOrCreatePortalRoot(id));

  useEffect(() => {
    const node = getOrCreatePortalRoot(id);
    if (node && node !== root) setRoot(node);
    return undefined;
  }, [id]);

  return root;
}

export default function Portal({ children, id = DEFAULT_PORTAL_ID }) {
  const root = usePortalRoot(id);
  if (!root) return null;
  return createPortal(children, root);
}
