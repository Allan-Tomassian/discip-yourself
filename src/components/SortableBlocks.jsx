import React, { useCallback, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function DragHandle({ label = "Déplacer" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="dragHandle"
      style={{
        cursor: "grab",
        userSelect: "none",
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(0,0,0,.18)",
        color: "rgba(255,255,255,.9)",
        borderRadius: 10,
        padding: "6px 10px",
        lineHeight: 1,
      }}
    >
      ⋮⋮
    </button>
  );
}

function SortableItem({ id, children, handleLabel }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div {...attributes} {...listeners}>
          <DragHandle label={handleLabel} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * SortableBlocks
 * - order: string[] (current order)
 * - setOrder: (nextOrder: string[]) => void
 * - items: Array<{ id: string, render: () => React.ReactNode }>
 */
export default function SortableBlocks({
  order,
  setOrder,
  items,
  handleLabel = "Déplacer le bloc",
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemsById = useMemo(() => {
    const map = new Map();
    for (const it of Array.isArray(items) ? items : []) {
      if (it && typeof it.id === "string") map.set(it.id, it);
    }
    return map;
  }, [items]);

  const orderedIds = useMemo(() => {
    const base = Array.isArray(order) ? order : [];
    const known = new Set(itemsById.keys());
    const filtered = base.filter((id) => known.has(id));
    for (const id of known) if (!filtered.includes(id)) filtered.push(id);
    return filtered;
  }, [order, itemsById]);

  const onDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!active?.id || !over?.id) return;
      if (active.id === over.id) return;
      const oldIndex = orderedIds.indexOf(active.id);
      const newIndex = orderedIds.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = arrayMove(orderedIds, oldIndex, newIndex);
      if (typeof setOrder === "function") setOrder(next);
    },
    [orderedIds, setOrder]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="stack stackGap12">
          {orderedIds.map((id) => {
            const it = itemsById.get(id);
            if (!it) return null;
            const node = typeof it.render === "function" ? it.render() : null;
            return (
              <SortableItem key={id} id={id} handleLabel={handleLabel}>
                {node}
              </SortableItem>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
