// src/components/SortableBlocks.jsx
import React, { useCallback, useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";

/**
 * Drag handle (copié depuis Home)
 * -> À utiliser dans tes headers de cartes.
 */
export function DragHandle({ setActivatorNodeRef, listeners, attributes }) {
  return (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label="Réorganiser"
      {...listeners}
      {...attributes}
      style={{
        width: 18,
        height: 18,
        padding: 0,
        border: 0,
        borderRadius: 6,
        background: "transparent",
        color: "rgba(255,255,255,0.5)",
        fontSize: 12,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "grab",
      }}
    >
      ⋮⋮
    </button>
  );
}

/**
 * Wrapper sortable (copié depuis Home)
 * -> children est une fonction pour récupérer (attributes/listeners/setActivatorNodeRef).
 */
export function SortableBlock({ id, children, disabled = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const scale = isDragging ? 1.02 : 1;
  const transformString = CSS.Transform.toString(transform);
  const style = {
    transform: transformString ? `${transformString} scale(${scale})` : `scale(${scale})`,
    transition,
    boxShadow: isDragging ? "0 16px 28px rgba(0,0,0,0.25)" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === "function"
        ? children({ attributes, listeners, setActivatorNodeRef, isDragging })
        : children}
    </div>
  );
}

/**
 * Composant réutilisable : même DnD que Home
 *
 * API recommandée:
 * - items: array d'ids ou d'objets
 * - getId: (item) => string
 * - onReorder: (nextItems) => void
 * - renderItem: (item, dndProps) => ReactNode
 *
 * Exemple:
 * <SortableBlocks
 *   items={items}
 *   getId={(item) => item.id}
 *   onReorder={setItems}
 *   renderItem={(item, dnd) => (
 *     <Card>
 *       <DragHandle {...dnd} />
 *       ...
 *     </Card>
 *   )}
 * />
 */
export default function SortableBlocks({
  items,
  getId,
  onReorder,
  renderItem,
  className,
  disabled = false,
  modifiers = [restrictToVerticalAxis, restrictToParentElement],
}) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);
  const resolveId = useCallback(
    (item) => (typeof getId === "function" ? getId(item) : item),
    [getId]
  );
  const order = useMemo(
    () => safeItems.map((item) => resolveId(item)).filter(Boolean),
    [safeItems, resolveId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } })
  );

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event;
      if (!active?.id || !over?.id) return;
      if (active.id === over.id) return;

      const oldIndex = order.indexOf(active.id);
      const newIndex = order.indexOf(over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      if (oldIndex === newIndex) return;

      const next = arrayMove(safeItems, oldIndex, newIndex);
      const nextOrder = next.map((item) => resolveId(item)).filter(Boolean);
      const sameOrder =
        nextOrder.length === order.length && nextOrder.every((id, idx) => id === order[idx]);
      if (sameOrder) return;
      if (typeof onReorder === "function") onReorder(next);
    },
    [order, safeItems, resolveId, onReorder]
  );

  if (typeof renderItem !== "function") return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={modifiers}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className={className || ""}>
          {safeItems.map((item, index) => {
            const id = order[index];
            if (!id) return null;
            return (
              <SortableBlock key={id} id={id} disabled={disabled}>
                {({ attributes, listeners, setActivatorNodeRef }) =>
                  renderItem(item, { attributes, listeners, setActivatorNodeRef, id })
                }
              </SortableBlock>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
