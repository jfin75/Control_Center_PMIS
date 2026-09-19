"use client";

import { useState } from "react";
import { Eye, FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/data";
import { Button } from "@/components/ui/controls";
import { Modal } from "@/components/ui/overlay";
import { Panel } from "@/components/ui/Panel";
import { blankContract } from "@/lib/contracts";
import { CATEGORIES, CATEGORY_ORDER, MOD_TYPES, ORDER_NAME, STRUCTURES, TEMPLATES, type Template } from "@/mock/contracts";
import { DocPreview, DownloadDocButton } from "./Document";
import { plural } from "./parts";
import { useContracts } from "./state";

/** The Owner's form library, one panel per kind of counterparty. */
export function Templates() {
  const { contracts, startContract } = useContracts();
  const [preview, setPreview] = useState<Template | null>(null);
  const uses = (t: Template) => contracts.filter((c) => c.templateId === t.id).length;
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {CATEGORY_ORDER.map((cat) => (
        <Panel key={cat} title={CATEGORIES[cat].label} info={`${CATEGORIES[cat].party} forms. Changes post to ${CATEGORIES[cat].code} and its change line.`}>
          <ul className="-mx-5 divide-y divide-line-soft">
            {TEMPLATES.filter((t) => t.category === cat).map((t) => {
              const fields = t.sections.flatMap((s) => s.fields);
              return (
                <li key={t.id} className="px-5 py-4 first:pt-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{t.name}</span>
                        <Badge tone={t.structure === "master" ? "accent" : t.structure === "task" ? "info" : "neutral"} dot={false}>
                          {t.structure === "task" ? ORDER_NAME[t.category].name : STRUCTURES[t.structure].label}
                        </Badge>
                      </p>
                      <p className="num mt-0.5 text-xs text-ink-3">
                        {t.form} · {plural(fields.filter((f) => f.required).length, "required blank")} · {plural(t.exhibits.length, "exhibit")} · {plural(uses(t), "contract")} use it
                      </p>
                      <p className="mt-1 text-sm text-ink-2">{t.description}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        Changes by {t.mods.map((m) => MOD_TYPES[m].label.toLowerCase()).join(", ")}.
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" aria-hidden />} onClick={() => setPreview(t)}>
                        Preview
                      </Button>
                      <Button size="sm" variant="tint" icon={<FilePlus2 className="size-3.5" aria-hidden />} onClick={() => startContract({ templateId: t.id })}>
                        Use
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.name ?? "Template"} description={preview ? `${preview.form} · blanks are marked where the form asks for them` : undefined} className="w-[min(52rem,calc(100vw-2rem))]">
        {preview && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-5 py-6 sm:px-10">
              <DocPreview c={blankContract(preview, "")} t={preview} all={contracts} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
              <DownloadDocButton c={blankContract(preview, "")} t={preview} all={contracts} />
              <Button
                variant="primary"
                icon={<FilePlus2 className="size-3.5" aria-hidden />}
                onClick={() => {
                  const t = preview;
                  setPreview(null);
                  startContract({ templateId: t.id });
                }}
              >
                Start a contract from this
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
