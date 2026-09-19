"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, CornerDownLeft, FileCheck2, FileDiff, FileSignature, FileText, FolderKanban, Gavel, Hash, Lightbulb, MessageCircleQuestionMark, Search, Users } from "lucide-react";
import { Modal } from "@/components/ui/overlay";
import { cx } from "@/lib/format";
import { search, SEARCH_INDEX, type SearchHit, type SearchKind } from "@/lib/search";

const KIND_ICON: Record<SearchKind, ReactNode> = {
  Page: <FileText className="size-4" aria-hidden />,
  Property: <Building2 className="size-4" aria-hidden />,
  Project: <FolderKanban className="size-4" aria-hidden />,
  "Cost code": <Hash className="size-4" aria-hidden />,
  Contractor: <Users className="size-4" aria-hidden />,
  "Bid package": <Gavel className="size-4" aria-hidden />,
  "Planning request": <Lightbulb className="size-4" aria-hidden />,
  Submittal: <FileCheck2 className="size-4" aria-hidden />,
  RFI: <MessageCircleQuestionMark className="size-4" aria-hidden />,
  Contract: <FileSignature className="size-4" aria-hidden />,
  "Contract change": <FileDiff className="size-4" aria-hidden />,
};

const KIND_ORDER: SearchKind[] = ["Page", "Project", "Property", "Cost code", "Contractor", "Bid package", "Planning request", "Submittal", "RFI", "Contract", "Contract change"];

const SUGGESTED = ["page-/portfolio/", "page-/cost/", "page-/cost/cash-flow/", "proj-ehs-ed", "prop-hmc-tacoma", "code-3.03", "firm-c-graystone"];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const hits: SearchHit[] = useMemo(() => {
    if (!q.trim()) {
      return SUGGESTED.map((id) => SEARCH_INDEX.find((i) => i.id === id)!).filter(Boolean).map((i) => ({ ...i, indexes: [], score: 0 }));
    }
    return search(q);
  }, [q]);

  const groups = useMemo(() => {
    if (!q.trim()) return [{ kind: "Suggested" as const, items: hits }];
    return KIND_ORDER.map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind).slice(0, kind === "Cost code" ? 6 : 5) })).filter((g) => g.items.length);
  }, [hits, q]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(h: SearchHit | undefined) {
    if (!h) return;
    onClose();
    router.push(h.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Home") {
      setActive(0);
    } else if (e.key === "End") {
      setActive(flat.length - 1);
    }
  }

  let idx = -1;
  return (
    <Modal open={open} onClose={onClose} title="Search" hideHeader initialFocus={inputRef} className="!mt-[12vh] !mb-auto w-[min(42rem,calc(100vw-2rem))]">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
          aria-label="Search properties, projects, cost codes, contractors"
          placeholder="Search properties, projects, cost codes, contractors…"
          className="h-14 flex-1 bg-transparent text-md text-ink outline-none placeholder:text-ink-3"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="rounded-xs border border-line px-1.5 text-2xs font-semibold text-ink-3">Esc</kbd>
      </div>
      <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="max-h-[26rem] overflow-y-auto p-2">
        {flat.length === 0 && (
          <div className="px-4 py-10 text-center">
            <p className="text-md font-semibold text-ink">No matches for “{q}”</p>
            <p className="mt-1 text-sm text-ink-2">Try a project code like CP-24017, a cost code like 3.03, or a city.</p>
          </div>
        )}
        {groups.map((g) => (
          <div key={g.kind} role="group" aria-label={g.kind} className="mb-1">
            <div className="px-3 pt-2 pb-1 text-2xs font-semibold text-ink-3">{g.kind}</div>
            {g.items.map((h) => {
              idx++;
              const i = idx;
              const on = i === active;
              return (
                <div
                  key={h.id}
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(h)}
                  className={cx("flex cursor-pointer items-center gap-3 rounded-md px-3 py-2", on ? "bg-accent-tint" : "")}
                >
                  <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-md", on ? "bg-surface text-accent-ink" : "bg-sunk text-ink-3")}>{KIND_ICON[h.kind]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      <Highlight text={h.title} indexes={h.indexes} />
                    </span>
                    <span className="block truncate text-xs text-ink-3">{h.meta}</span>
                  </span>
                  {on && <CornerDownLeft className="size-3.5 shrink-0 text-accent-ink" aria-hidden />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 border-t border-line bg-surface-2 px-4 py-2 text-2xs text-ink-3">
        <span>
          <kbd className="font-semibold">↑↓</kbd> move
        </span>
        <span>
          <kbd className="font-semibold">Enter</kbd> open
        </span>
        <span className="ml-auto">{SEARCH_INDEX.length} records indexed</span>
      </div>
    </Modal>
  );
}

function Highlight({ text, indexes }: { text: string; indexes: number[] }) {
  if (!indexes.length) return <>{text}</>;
  const set = new Set(indexes);
  const out: ReactNode[] = [];
  let buf = "";
  let inMark = false;
  for (let i = 0; i < text.length; i++) {
    const m = set.has(i);
    if (m !== inMark) {
      if (buf) out.push(inMark ? <mark key={i} className="rounded-[2px] bg-transparent text-accent-ink underline decoration-2 underline-offset-2">{buf}</mark> : buf);
      buf = "";
      inMark = m;
    }
    buf += text[i];
  }
  if (buf) out.push(inMark ? <mark key="end" className="bg-transparent text-accent-ink underline decoration-2 underline-offset-2">{buf}</mark> : buf);
  return <>{out}</>;
}
