"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, EyeOff, GripVertical, Plus, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/controls";
import { Em, Narrative } from "@/components/ui/data";
import { InfoTip } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/Panel";
import { sumChain } from "@/lib/budget";
import { cx, money, pct } from "@/lib/format";
import { useStoredState } from "@/lib/prefs";
import { PROJECTS } from "@/mock/projects";
import { SECTIONS, SectionSummary, WIDGETS, type Section, type WidgetDef } from "./widgets";

interface Layout {
  order: Record<Section, string[]>;
  hidden: string[];
}

const DEFAULT_LAYOUT: Layout = {
  order: Object.fromEntries(SECTIONS.map((s) => [s, WIDGETS.filter((w) => w.section === s).map((w) => w.id)])) as Record<Section, string[]>,
  hidden: [],
};

export function DashboardView() {
  const [layout, setLayout] = useStoredState<Layout>("cc.dashboard.v1", DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const t = sumChain(PROJECTS.map((p) => p.totals));
  const risky = PROJECTS.filter((p) => p.status !== "on-schedule");
  const hiddenDefs = WIDGETS.filter((w) => layout.hidden.includes(w.id));

  function onDragEnd(section: Section, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLayout((l) => {
      const ids = l.order[section];
      return { ...l, order: { ...l.order, [section]: arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))) } };
    });
  }

  const hide = (id: string) => setLayout((l) => ({ ...l, hidden: [...l.hidden, id] }));
  const show = (id: string) => setLayout((l) => ({ ...l, hidden: l.hidden.filter((x) => x !== id) }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        meta="Executive view across real estate, capital equipment, and construction"
        actions={
          editing ? (
            <>
              <Button variant="ghost" icon={<RotateCcw className="size-3.5" aria-hidden />} onClick={() => setLayout(DEFAULT_LAYOUT)}>
                Reset layout
              </Button>
              <Button variant="primary" icon={<Check className="size-3.5" aria-hidden />} onClick={() => setEditing(false)}>
                Done
              </Button>
            </>
          ) : (
            <Button icon={<SlidersHorizontal className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
              Customize
            </Button>
          )
        }
      />

      <div className="panel mb-6 px-5 py-4">
        <Narrative>
          Ten active projects carry <Em>{money(t.C, { compact: true })}</Em> of approved capital, <Em>{pct(t.D / t.C)}</Em> committed.{" "}
          <Em tone="neg">{risky.length} projects</Em> are off their baseline schedule, and the program forecasts{" "}
          {t.H >= 0 ? <Em tone="pos">{money(t.H, { compact: true })} under budget</Em> : <Em tone="neg">{money(-t.H, { compact: true })} over budget</Em>}.
        </Narrative>
      </div>

      {editing && (
        <div className="mb-6 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-3" role="region" aria-label="Customize dashboard">
          <p className="text-sm text-ink-2">
            Drag a widget by its handle — or focus the handle and use <kbd className="rounded-xs border border-line px-1 text-2xs font-semibold">Space</kbd> and arrow keys — to reorder within a section. Hide widgets you don’t need.
          </p>
          {hiddenDefs.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-3">Hidden:</span>
              {hiddenDefs.map((w) => (
                <Button key={w.id} size="sm" variant="tint" icon={<Plus className="size-3" aria-hidden />} onClick={() => show(w.id)}>
                  {w.title}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {SECTIONS.map((section) => {
        const ids = layout.order[section].filter((id) => !layout.hidden.includes(id));
        return (
          <section key={section} className="mb-8" aria-labelledby={`sec-${section}`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id={`sec-${section}`} className="text-lg font-semibold tracking-[-0.01em] text-ink">
                {section}
              </h2>
              <SectionSummary section={section} />
            </div>
            {ids.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-center text-sm text-ink-2">
                All {section.toLowerCase()} widgets are hidden. Choose <strong>Customize</strong> to bring them back.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(section, e)}>
                <SortableContext items={ids} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {ids.map((id) => (
                      <SortableWidget key={id} def={WIDGETS.find((w) => w.id === id)!} editing={editing} onHide={() => hide(id)} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </section>
        );
      })}
    </>
  );
}

function SortableWidget({ def, editing, onHide }: { def: WidgetDef; editing: boolean; onHide: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: def.id, disabled: !editing });
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-labelledby={`w-${def.id}`}
      className={cx(
        "panel flex min-w-0 flex-col",
        editing && "ring-1 ring-line-strong",
        isDragging && "relative z-10 shadow-overlay ring-2 ring-accent",
        def.wide && "xl:col-span-2",
      )}
    >
      <header className="flex min-h-14 items-center gap-2 px-5 pt-4 pb-3">
        {editing && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Move ${def.title}`}
            className="-ml-2 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink active:cursor-grabbing"
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <h3 id={`w-${def.id}`} className="flex flex-1 items-center gap-1.5 text-md font-semibold text-ink">
          {def.title}
          <InfoTip label={def.info} />
        </h3>
        {editing && (
          <button type="button" onClick={onHide} aria-label={`Hide ${def.title}`} title="Hide widget" className="inline-flex size-7 items-center justify-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink">
            <EyeOff className="size-4" aria-hidden />
          </button>
        )}
      </header>
      <div className="min-w-0 flex-1 px-5 pb-5">{def.render()}</div>
    </article>
  );
}
