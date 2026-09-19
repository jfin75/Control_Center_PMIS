"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/controls";
import { toast } from "@/components/ui/overlay";
import { cx, fmtDate, money } from "@/lib/format";
import { renderDoc, type DocArticle } from "@/lib/contracts";
import { whoName } from "@/lib/rfis";
import { CATEGORIES, type Contract, type ExhibitDef, type ExhibitState, type Template } from "@/mock/contracts";
import { ORG } from "@/mock/org";
import { plural } from "./parts";

export const exhibitLetter = (t: Template, key: string) => String.fromCharCode(65 + t.exhibits.findIndex((x) => x.key === key));

/** Where an exhibit stands, in words. */
export function exhibitStatus(x: ExhibitDef, st: ExhibitState | undefined): { label: string; tone: "pos" | "neutral" | "warn"; done: boolean } {
  if (st?.files.length) return { label: plural(st.files.length, "file"), tone: "pos", done: true };
  if (x.standard && st?.standard) return { label: "Owner standard", tone: "pos", done: true };
  if (st?.note?.trim()) return { label: "Described", tone: "pos", done: true };
  if (!x.required && st?.na) return { label: "Not applicable", tone: "neutral", done: true };
  return x.required ? { label: "Missing", tone: "warn", done: false } : { label: "Optional", tone: "neutral", done: true };
}

/**
 * The contract as it will read, with the blanks filled. Filled blanks are
 * underlined; empty required ones are marked so they can't be missed.
 */
export function DocPreview({ c, t, all, className }: { c: Contract; t: Template; all: Contract[]; className?: string }) {
  const doc = renderDoc(c, t, all);
  const party = CATEGORIES[t.category].party;
  return (
    <article aria-label="Contract document" className={cx("mx-auto max-w-[44rem] text-[0.9375rem] leading-7 text-ink [font-family:Georgia,'Times_New_Roman',serif]", className)}>
      <header className="border-b border-line pb-4 text-center">
        <p className="text-xs text-ink-3 [font-family:var(--font-sans)]">
          {ORG.name} · {t.form}
        </p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{t.name}</h3>
        <p className="mt-0.5 text-sm text-ink-2">
          {c.number || "Number assigned on save"}
          {c.title && ` · ${c.title}`}
        </p>
      </header>
      <ol className="mt-4 space-y-3">
        {doc.map((a, i) => (
          <li key={a.heading}>
            <h4 className="font-semibold text-ink">
              {i + 1}. {a.heading}
            </h4>
            <p className="mt-0.5 text-ink-2 [text-wrap:pretty]">
              <Pieces a={a} />
            </p>
          </li>
        ))}
        <li>
          <h4 className="font-semibold text-ink">{doc.length + 1}. Exhibits</h4>
          <ul className="mt-0.5 space-y-0.5 text-ink-2">
            {t.exhibits.map((x) => {
              const s = exhibitStatus(
                x,
                c.exhibits.find((e) => e.key === x.key),
              );
              return (
                <li key={x.key}>
                  Exhibit {exhibitLetter(t, x.key)}, {x.title}{" "}
                  <span className={cx("text-xs [font-family:var(--font-sans)]", s.done ? "text-ink-3" : "font-semibold text-warn-ink")}>({s.label.toLowerCase()})</span>
                </li>
              );
            })}
          </ul>
        </li>
      </ol>
      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-line pt-4 text-sm sm:grid-cols-2">
        {[
          ["Owner", ORG.name],
          [party, c.counterpartyId ? whoName({ kind: "firm", id: c.counterpartyId }) : "—"],
        ].map(([role, name]) => (
          <div key={role}>
            <div className="h-8 border-b border-ink-3" />
            <p className="mt-1 text-ink">{name}</p>
            <p className="text-xs text-ink-3 [font-family:var(--font-sans)]">
              {role} · {c.executed ? `signed ${fmtDate(c.executed)}` : "signature and date"}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function Pieces({ a }: { a: DocArticle }) {
  return (
    <>
      {a.pieces.map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>;
        if (p.value) return <span key={i} className="text-ink underline decoration-accent/50 decoration-1 underline-offset-[3px]">{p.value}</span>;
        if (!p.required) return <span key={i} className="text-ink-3 italic">{p.key === "effective" ? "the date of execution" : "none"}</span>;
        return (
          <mark key={i} className="rounded-xs bg-warn-tint px-1 text-xs font-semibold text-warn-ink not-italic [font-family:var(--font-sans)]">
            [{p.label}]
          </mark>
        );
      })}
    </>
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Word opens HTML saved as .doc, so the draft can go to Legal without a converter. */
export function downloadDoc(c: Contract, t: Template, all: Contract[]) {
  const doc = renderDoc(c, t, all);
  const body = doc
    .map(
      (a, i) =>
        `<h2>${i + 1}. ${esc(a.heading)}</h2><p>${a.pieces
          .map((p) => (typeof p === "string" ? esc(p) : p.value ? `<u>${esc(p.value)}</u>` : p.required ? `<span style="background:#fde68a">[${esc(p.label)}]</span>` : p.key === "effective" ? "the date of execution" : "none"))
          .join("")}</p>`,
    )
    .join("\n");
  const exhibits = t.exhibits
    .map((x) => `<li>Exhibit ${exhibitLetter(t, x.key)}, ${esc(x.title)} (${exhibitStatus(x, c.exhibits.find((e) => e.key === x.key)).label.toLowerCase()})</li>`)
    .join("");
  const html = `<html><head><meta charset="utf-8"><title>${esc(c.number || t.name)}</title>
<style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.5}h1{font-size:15pt;text-align:center}h2{font-size:11pt;margin:14pt 0 2pt}p.meta{text-align:center;color:#555}</style></head>
<body><p class="meta">${esc(ORG.name)} · ${esc(t.form)}</p><h1>${esc(t.name)}</h1><p class="meta">${esc(c.number || "Draft")}${c.title ? ` · ${esc(c.title)}` : ""}${c.status !== "executed" && c.status !== "closed" ? " · DRAFT" : ""}</p>
${body}
<h2>${doc.length + 1}. Exhibits</h2><ul>${exhibits}</ul>
<p style="margin-top:28pt">Value: ${esc(money(t.value(c.values)))} (${esc(t.valueLabel.toLowerCase())})</p>
</body></html>`;
  const url = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/msword" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(c.number || "Draft contract").replace(/[^\w.-]+/g, " ").trim()}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${link.download} downloaded`);
}

export function DownloadDocButton({ c, t, all, size = "md" }: { c: Contract; t: Template; all: Contract[]; size?: "sm" | "md" }) {
  return (
    <Button size={size} icon={<Download className="size-3.5" aria-hidden />} onClick={() => downloadDoc(c, t, all)}>
      Download .doc
    </Button>
  );
}
