"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/overlay";
import { deleteFiles, downloadFile, fmtBytes, getFile, isImage, MAX_FILE_BYTES, putFile } from "@/lib/attachments";
import { cx } from "@/lib/format";
import { newId, whoName } from "@/lib/rfis";
import { TODAY } from "@/mock/org";
import type { Attachment, Who } from "@/mock/rfis";
import { shortDate } from "./parts";

/** Write picked files to browser storage and return their records. Throws if storage fails. */
export async function storeFiles(files: File[], by: Who, projectId: string): Promise<Attachment[]> {
  const out: Attachment[] = [];
  try {
    for (const f of files) {
      const a: Attachment = { id: newId(`${projectId}:file`), name: f.name, size: f.size, type: f.type || "application/octet-stream", added: TODAY, by, stored: true };
      await putFile(a.id, f);
      out.push(a);
    }
  } catch (e) {
    await deleteFiles(out.map((a) => a.id)).catch(() => undefined);
    throw e;
  }
  return out;
}

/**
 * File picker with drag and drop. Holds picked files until the parent posts
 * them; nothing is stored until then.
 */
export function FileDrop({ files, onChange, compact }: { files: File[]; onChange: (f: File[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = [...list];
    const big = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (big.length) toast(`${big.map((f) => f.name).join(", ")} ${big.length === 1 ? "is" : "are"} over ${fmtBytes(MAX_FILE_BYTES)} and ${big.length === 1 ? "was" : "were"} skipped`);
    onChange([...files, ...picked.filter((f) => f.size <= MAX_FILE_BYTES && !files.some((x) => x.name === f.name && x.size === f.size))]);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        add(e.dataTransfer.files);
      }}
      className={cx("rounded-md border border-dashed transition-colors duration-[var(--dur-fast)]", over ? "border-accent bg-accent-wash" : "border-line-strong", compact ? "px-2.5 py-1.5" : "px-3 py-2.5")}
    >
      <input
        ref={input}
        id={id}
        type="file"
        multiple
        className="sr-only"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-accent-ink hover:underline">
          <Paperclip className="size-3.5" aria-hidden />
          Attach files
        </label>
        <span className="text-xs text-ink-3">or drop them here · up to {fmtBytes(MAX_FILE_BYTES)} each</span>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-sm bg-sunk py-0.5 pr-0.5 pl-2 text-xs text-ink-2">
              <span className="truncate">{f.name}</span>
              <span className="num shrink-0 text-ink-3">{fmtBytes(f.size)}</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))} className="inline-flex size-5 items-center justify-center rounded-xs text-ink-3 hover:bg-surface hover:text-ink">
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A stored image's thumbnail, loaded from browser storage. */
function Thumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    let live = true;
    getFile(id)
      .then((b) => {
        if (b && live) {
          u = URL.createObjectURL(b);
          setUrl(u);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  if (!url) return <ImageIcon className="size-4 text-ink-3" aria-hidden />;
  return <img src={url} alt="" className="size-8 rounded-xs object-cover" />;
}

async function download(a: Attachment) {
  try {
    if (!(await downloadFile(a.id, a.name))) toast(`${a.name} is no longer in this browser's storage`);
  } catch {
    toast("File storage is not available");
  }
}

/** One attachment: stored files download; seeded ones are a record of the file only. */
export function AttachmentChip({ a, onRemove }: { a: Attachment; onRemove?: () => void }) {
  const icon = a.stored && isImage(a.type) ? <Thumb id={a.id} /> : isImage(a.type) ? <ImageIcon className="size-4 text-ink-3" aria-hidden /> : <FileText className="size-4 text-ink-3" aria-hidden />;
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-line bg-surface py-1 pr-1 pl-2">
      <span className="inline-flex size-8 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0">
        {a.stored ? (
          <button type="button" onClick={() => download(a)} className="block max-w-[16rem] truncate text-left text-xs font-semibold text-accent-ink hover:underline" title={`Download ${a.name}`}>
            {a.name}
          </button>
        ) : (
          <span className="block max-w-[16rem] truncate text-xs font-semibold text-ink" title="Sample record: the file itself isn't stored in this demo">
            {a.name}
          </span>
        )}
        <span className="num block text-2xs text-ink-3">
          {fmtBytes(a.size)}
          {!a.stored && " · record only"}
        </span>
      </span>
      {a.stored && (
        <button type="button" aria-label={`Download ${a.name}`} onClick={() => download(a)} className="inline-flex size-7 items-center justify-center rounded-sm text-ink-3 hover:bg-sunk hover:text-ink">
          <Download className="size-3.5" aria-hidden />
        </button>
      )}
      {onRemove && (
        <button type="button" aria-label={`Remove ${a.name}`} onClick={onRemove} className="inline-flex size-7 items-center justify-center rounded-sm text-ink-3 hover:bg-neg-tint hover:text-neg-ink">
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      )}
    </span>
  );
}

export function AttachmentList({ files, className }: { files: Attachment[]; className?: string }) {
  if (!files.length) return null;
  return (
    <ul className={cx("flex flex-wrap gap-1.5", className)}>
      {files.map((a) => (
        <li key={a.id} className="max-w-full">
          <AttachmentChip a={a} />
        </li>
      ))}
    </ul>
  );
}

export const fileMeta = (a: Attachment) => `${whoName(a.by)} · ${shortDate(a.added)}`;
