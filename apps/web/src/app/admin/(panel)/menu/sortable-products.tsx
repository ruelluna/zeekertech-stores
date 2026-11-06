"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { unstable_rethrow } from "next/navigation";
import { startTransition, useOptimistic, type ReactNode } from "react";
import { toast } from "@/lib/toast";
import { reorderProducts } from "./actions";

export interface SortableProduct {
  id: string;
  name: string;
  /** The row's content, rendered on the server. */
  row: ReactNode;
}

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** One category's products, reordered by dragging a row's handle (mouse, touch or keyboard). */
export function SortableProducts({ categoryId, products }: { categoryId: string; products: SortableProduct[] }) {
  // Shows the new order right away; goes back to the server's order when the save finishes, so a failed save undoes itself.
  const [order, setOrder] = useOptimistic(products.map((p) => p.id));
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const byId = new Map(products.map((p) => [p.id, p]));
  const nameOf = (id: string | number) => byId.get(String(id))?.name ?? "Product";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} moved to ${nameOf(over.id)}'s place.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at ${nameOf(over.id)}'s place.` : `${nameOf(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    startTransition(async () => {
      setOrder(next);
      try {
        const result = await reorderProducts(categoryId, next);
        if (result?.ok) toast({ title: result.message, tone: "success" });
        else toast({ title: "Order not saved", body: result?.message, tone: "error" });
      } catch (error) {
        unstable_rethrow(error); // An expired session redirects to the login page.
        toast({ title: "Order not saved", body: "Check your connection and try again.", tone: "error" });
      }
    });
  }

  return (
    // A fixed id keeps the server and browser markup the same.
    <DndContext
      id={`category-${categoryId}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[verticalOnly]}
      accessibility={{ announcements }}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {order.map((id) => {
            const product = byId.get(id);
            return product && <SortableRow key={id} product={product} showHandle={products.length > 1} />;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ product, showHandle }: { product: SortableProduct; showHandle: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      className={`flex items-start gap-1 bg-surface ${isDragging ? "relative z-10 rounded-lg outline-2 outline-accent" : ""}`}
    >
      {showHandle && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Move ${product.name}`}
          title="Drag to reorder"
          className="-ml-1 mt-2 flex h-11 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted hover:bg-ink-100 hover:text-ink-900 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-accent dark:hover:bg-ink-800 dark:hover:text-ink-100"
        >
          <svg viewBox="0 0 12 20" width="12" height="20" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="4" r="1.5" />
            <circle cx="9" cy="4" r="1.5" />
            <circle cx="3" cy="10" r="1.5" />
            <circle cx="9" cy="10" r="1.5" />
            <circle cx="3" cy="16" r="1.5" />
            <circle cx="9" cy="16" r="1.5" />
          </svg>
        </button>
      )}
      <div className="min-w-0 flex-1">{product.row}</div>
    </li>
  );
}
