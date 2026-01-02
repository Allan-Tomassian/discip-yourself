import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCategoryAccentVars } from "../utils/categoryAccent";

const LONG_PRESS_MS = 250;

function arrayMove(list, from, to) {
  if (from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function CategoryRail({
  categories,
  order,
  selectedId,
  onSelect,
  onOpenDetail,
  onReorder,
}) {
  const [localOrder, setLocalOrder] = useState(order);
  const [draggingId, setDraggingId] = useState(null);
  const itemRefs = useRef(new Map());
  const pressRef = useRef({
    id: null,
    timer: null,
    longPress: false,
    pointerId: null,
  });

  useEffect(() => {
    if (draggingId) return;
    setLocalOrder(order);
  }, [order, draggingId]);

  const items = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return localOrder.map((id) => map.get(id)).filter(Boolean);
  }, [categories, localOrder]);

  function clearPress() {
    if (pressRef.current.timer) clearTimeout(pressRef.current.timer);
    pressRef.current = { id: null, timer: null, longPress: false, pointerId: null };
  }

  function handlePointerDown(e, id) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pressRef.current.id = id;
    pressRef.current.pointerId = e.pointerId;
    pressRef.current.longPress = false;
    pressRef.current.timer = setTimeout(() => {
      pressRef.current.longPress = true;
      setDraggingId(id);
    }, LONG_PRESS_MS);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!draggingId) return;
    e.preventDefault();
    const x = e.clientX;
    const orderIds = localOrder;
    const currentIndex = orderIds.indexOf(draggingId);
    if (currentIndex < 0) return;
    let targetIndex = orderIds.length - 1;
    for (let i = 0; i < orderIds.length; i += 1) {
      const el = itemRefs.current.get(orderIds[i]);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      if (x < mid) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex !== currentIndex) {
      setLocalOrder((prev) => arrayMove(prev, currentIndex, targetIndex));
    }
  }

  function handlePointerUp(e, id) {
    const wasLongPress = pressRef.current.longPress;
    clearPress();
    if (draggingId) {
      setDraggingId(null);
      if (typeof onReorder === "function") onReorder(localOrder);
      return;
    }
    if (!wasLongPress && id && typeof onSelect === "function") {
      onSelect(id);
    }
  }

  function handlePointerCancel() {
    clearPress();
    if (draggingId) setDraggingId(null);
  }

  return (
    <div
      className="scrollNoBar"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
        touchAction: draggingId ? "none" : "pan-x",
      }}
    >
      {items.map((c) => {
        const isActive = c.id === selectedId;
        const accentVars = getCategoryAccentVars(c.color);
        return (
          <button
            key={c.id}
            ref={(el) => {
              if (el) itemRefs.current.set(c.id, el);
            }}
            type="button"
            className={`listItem${isActive ? " catAccentRow" : ""}`}
            style={{
              ...(isActive ? accentVars : null),
              minWidth: "max-content",
              padding: "8px 12px",
              borderRadius: 14,
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 8,
              opacity: draggingId && draggingId !== c.id ? 0.7 : 1,
              cursor: draggingId ? "grabbing" : "pointer",
            }}
            onPointerDown={(e) => handlePointerDown(e, c.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => handlePointerUp(e, c.id)}
            onPointerCancel={handlePointerCancel}
            onDoubleClick={() => {
              if (typeof onOpenDetail === "function") onOpenDetail(c.id);
            }}
          >
            <span className="itemTitle">{c.name || "Catégorie"}</span>
          </button>
        );
      })}
    </div>
  );
}
