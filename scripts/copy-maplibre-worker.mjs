// MapLibre GL v6 loads its web worker as a separate ES module resolved from
// import.meta.url, which bundlers rewrite. Serve the worker (and the shared
// chunk it imports) from /maplibre/ so the same path works on Vercel, in
// `next dev`, and inside the Tauri webview.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const out = join(root, "public", "maplibre");
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, f), join(out, f));
}
console.log("maplibre worker copied to public/maplibre/");
