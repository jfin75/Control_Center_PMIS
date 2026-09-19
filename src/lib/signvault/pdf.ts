/** A plain PDF of a contract for SignVault to seal: the filled-in articles,
 *  the exhibit list, and a signature page whose signature and date boxes sit
 *  at known points, so the envelope's fields land on them exactly. Written by
 *  hand (PDF 1.7, standard Times fonts, WinAnsi text) to avoid shipping a PDF
 *  library for one document. */

import type { FieldInput } from "./client";

const PAGE = { width: 612, height: 792 };
const MARGIN = { x: 72, top: 72, bottom: 72 };
const LINE = 1.35;

/* ---- Standard 14 font widths (1/1000 em), ASCII 32–126 ---------------- */

const TIMES = [250,333,408,500,500,833,778,333,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541]; // prettier-ignore
const TIMES_BOLD = [250,333,555,500,500,1000,833,333,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520]; // prettier-ignore

type Font = "R" | "B";

/** Windows-1252 bytes for the punctuation the documents use; anything else outside Latin-1 becomes "?". */
const CP1252: Record<string, number> = { "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99 };

function encode(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    const cp = ch.codePointAt(0)!;
    const b = CP1252[ch] ?? (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff) ? cp : cp === 0x2212 ? 0x2d : 0x3f);
    out += String.fromCharCode(b);
  }
  return out;
}

function width(s: string, font: Font, size: number): number {
  const table = font === "B" ? TIMES_BOLD : TIMES;
  let w = 0;
  for (const ch of encode(s)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c <= 126 ? table[c - 32]! : 500;
  }
  return (w / 1000) * size;
}

function wrap(text: string, font: Font, size: number, max: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (width(next, font, size) <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

const pdfString = (s: string) => `(${encode(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
const n = (v: number) => (Math.round(v * 100) / 100).toString();

/* ---- Layout ------------------------------------------------------------ */

export interface DocBlock {
  kind: "meta" | "title" | "subtitle" | "heading" | "para" | "item";
  text: string;
}

export interface SignerBlock {
  recipientId: string;
  /** "Owner", "Contractor", "Architect"… */
  role: string;
  party: string;
  name: string;
  email: string;
}

export interface BuiltPdf {
  bytes: Uint8Array;
  base64: string;
  pageCount: number;
  fields: FieldInput[];
}

const STYLE: Record<DocBlock["kind"], { font: Font; size: number; before: number; center?: boolean; indent?: number }> = {
  meta: { font: "R", size: 9, before: 0, center: true },
  title: { font: "B", size: 16, before: 6, center: true },
  subtitle: { font: "R", size: 11, before: 4, center: true },
  heading: { font: "B", size: 11.5, before: 14 },
  para: { font: "R", size: 11, before: 3 },
  item: { font: "R", size: 11, before: 2, indent: 14 },
};

export function buildContractPdf(blocks: DocBlock[], signers: SignerBlock[], footer: string): BuiltPdf {
  const pages: string[][] = [[]];
  let y = PAGE.height - MARGIN.top;
  const maxW = PAGE.width - MARGIN.x * 2;
  const text = (font: Font, size: number, x: number, yy: number, s: string) => pages[pages.length - 1]!.push(`BT /${font} ${n(size)} Tf ${n(x)} ${n(yy)} Td ${pdfString(s)} Tj ET`);
  const newPage = () => {
    pages.push([]);
    y = PAGE.height - MARGIN.top;
  };

  for (const b of blocks) {
    const st = STYLE[b.kind];
    const indent = st.indent ?? 0;
    const lines = wrap(b.text, st.font, st.size, maxW - indent);
    const lh = st.size * LINE;
    // Keep a heading with at least two lines of what follows it.
    const need = st.before + lh * (b.kind === "heading" ? 3 : 1);
    if (y - need < MARGIN.bottom) newPage();
    else y -= st.before;
    for (const line of lines) {
      if (y - lh < MARGIN.bottom) newPage();
      y -= lh;
      const x = st.center ? (PAGE.width - width(line, st.font, st.size)) / 2 : MARGIN.x + indent;
      text(st.font, st.size, x, y + st.size * 0.25, line);
    }
  }

  // Signature page: one block per signer, with the boxes the envelope's fields point at.
  newPage();
  text("B", 13, MARGIN.x, y - 13, "Signatures");
  y -= 30;
  text("R", 10.5, MARGIN.x, y, "Each party signs electronically through SignVault. The sealed PDF and its audit trail are the record of execution.");
  y -= 34;
  const sigPage = pages.length - 1;
  const fields: FieldInput[] = [];
  const box = { sigW: 250, sigH: 54, dateW: 140, dateH: 22 };
  for (const s of signers) {
    const top = y;
    text("B", 11, MARGIN.x, top, `${s.role}: ${s.party}`);
    const sigY = top - 14 - box.sigH;
    // Signature line under the box, date line to its right.
    pages[sigPage]!.push(`0.5 w ${n(MARGIN.x)} ${n(sigY)} m ${n(MARGIN.x + box.sigW)} ${n(sigY)} l S`);
    const dateX = MARGIN.x + box.sigW + 40;
    pages[sigPage]!.push(`${n(dateX)} ${n(sigY)} m ${n(dateX + box.dateW)} ${n(sigY)} l S`);
    text("R", 9.5, MARGIN.x, sigY - 12, `Signature · ${s.name}`);
    text("R", 9.5, MARGIN.x, sigY - 24, s.email);
    text("R", 9.5, dateX, sigY - 12, "Date signed");
    fields.push({ recipientId: s.recipientId, type: "SIGNATURE", pageNumber: sigPage, coordX: MARGIN.x, coordY: sigY + 2, width: box.sigW, height: box.sigH, isRequired: true });
    fields.push({ recipientId: s.recipientId, type: "DATE_SIGNED", pageNumber: sigPage, coordX: dateX, coordY: sigY + 2, width: box.dateW, height: box.dateH, isRequired: true });
    y = sigY - 60;
  }

  const total = pages.length;
  pages.forEach((p, i) => {
    const f = `${footer} · Page ${i + 1} of ${total}`;
    p.push(`BT /R 8.5 Tf ${n((PAGE.width - width(f, "R", 8.5)) / 2)} ${n(MARGIN.bottom / 2)} Td ${pdfString(f)} Tj ET`);
  });

  return { ...serialize(pages), pageCount: total, fields };
}

/* ---- Serialization ------------------------------------------------------ */

function serialize(pages: string[][]): { bytes: Uint8Array; base64: string } {
  // 1 catalog, 2 pages, 3 regular font, 4 bold font, then a page and a content stream per page.
  const objs: string[] = [];
  const kids = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>");
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((ops, i) => {
    const content = ops.join("\n");
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /R 3 0 R /B 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  let out = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character above is a single byte (WinAnsi), so string length is byte length.
  const bytes = Uint8Array.from(out, (c) => c.charCodeAt(0));
  return { bytes, base64: btoa(out) };
}
