#!/usr/bin/env node
/**
 * Builds docs/review/phase-1-ui-review.md from the code, so the review document cannot drift:
 *  - routes        ← apps/web/src/app/**\/page.tsx
 *  - screenshots   ← docs/review/screens.json (written by `pnpm screens`)
 *  - components    ← packages/ui/src/components/*.tsx exports + apps/web/src/components/**
 *  - scenarios     ← apps/web/src/mock/scenarios.ts (SCENARIOS)
 *  - narrative     ← docs/review/fragments/*.md (journeys, gaps, integration points, verification)
 * Usage: node scripts/build-review-doc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function walk(dir, filter, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(rel, filter, out);
    } else if (filter(rel)) out.push(rel);
  }
  return out;
}

// ── Routes ──────────────────────────────────────────────────────
const pages = walk("apps/web/src/app", (f) => f.endsWith("page.tsx"));
const routes = pages
  .map((f) => {
    const rel = path.relative("apps/web/src/app", path.dirname(f)).split(path.sep);
    const group = rel.find((s) => /^\(.+\)$/.test(s)) ?? "(root)";
    const url = "/" + rel.filter((s) => !/^\(.+\)$/.test(s)).join("/");
    return { group, url: url === "/" ? "/" : url.replace(/\/$/, "") };
  })
  .sort((a, b) => a.group.localeCompare(b.group) || a.url.localeCompare(b.url));
const groupLabel = { "(app)": "Back office", "(floor)": "Floor workspaces", "(auth)": "Authentication", "(root)": "Root" };

// ── Screens ─────────────────────────────────────────────────────
const screens = exists("docs/review/screens.json") ? JSON.parse(read("docs/review/screens.json")) : [];

// ── Components ──────────────────────────────────────────────────
function exportsOf(file) {
  const src = read(file);
  const names = new Set();
  for (const m of src.matchAll(/export (?:async )?(?:function|const|class) ([A-Z][A-Za-z0-9]+)/g)) names.add(m[1]);
  return [...names];
}
const uiFiles = walk("packages/ui/src/components", (f) => f.endsWith(".tsx"));
const uiList = uiFiles.map((f) => ({ file: path.basename(f), names: exportsOf(f) })).filter((x) => x.names.length);
const appCompFiles = walk("apps/web/src/components", (f) => f.endsWith(".tsx"));
const appByDir = {};
for (const f of appCompFiles) {
  const dir = path.relative("apps/web/src/components", path.dirname(f)).split(path.sep)[0] || "(root)";
  (appByDir[dir] ??= []).push(...exportsOf(f));
}

// ── Scenarios ───────────────────────────────────────────────────
const scenSrc = read("apps/web/src/mock/scenarios.ts");
const scenarios = [...scenSrc.matchAll(/\{ id: "([A-Z_]+)", label: "([^"]+)", description: "([^"]+)" \}/g)].map((m) => ({ id: m[1], label: m[2], description: m[3] }));

const fragment = (name) => (exists(`docs/review/fragments/${name}.md`) ? read(`docs/review/fragments/${name}.md`).trim() : `_(missing fragment: ${name})_`);

// ── Compose ─────────────────────────────────────────────────────
const lines = [];
const push = (...l) => lines.push(...l);
const today = new Date().toISOString().slice(0, 10);

push(
  "# Phase 1 UI review — Tobacco ERP",
  "",
  `Generated ${today} by \`scripts/build-review-doc.mjs\` from the code. **Phase 1 delivers a complete, navigable frontend on mocked data. No backend, database, real integration or payment exists. Backend work (Phase 2+) starts only after you approve this UI.**`,
  "",
  "## 1. How to review",
  "",
  "```bash",
  "pnpm install && pnpm dev     # http://localhost:3000",
  "```",
  "",
  "1. Pick a demo role on the login page (each of the 12 roles from the brief, plus a DEMO-only all-stage operator).",
  "2. Open the user menu → **Demo controls** to jump to any stage of the 17 September 2026 sale day, or reset.",
  "3. User menu → **Switch demo user** to see how permissions change what is visible and enabled (buttons show *why* they are disabled).",
  "4. Everything is local to your browser; nothing is sent anywhere. Look for **DEMO** (invented data) and **UNVERIFIED** (behaviour the manuals don't confirm) badges.",
  "",
  "## 2. Screens implemented",
  "",
  `${screens.length} captured screens (\`pnpm screens\` regenerates them). Roles shown are the demo role used for the shot.`,
  "",
  "| Screenshot | Route | Role | Stage preset |",
  "|---|---|---|---|",
  ...screens.map((s) => `| [${s.id}](${s.file}) | \`${s.path}\` | ${s.role ?? "signed out"} | ${s.scenario ?? "—"} |`),
  "",
);
for (const s of screens) push(`### ${s.id}`, "", `\`${s.path}\` · ${s.role ?? "signed out"}${s.scenario ? ` · preset ${s.scenario}` : ""}`, "", `![${s.id}](${s.file})`, "");

push("## 3. Route list", "");
for (const [g, label] of Object.entries(groupLabel)) {
  const list = routes.filter((r) => r.group === g);
  if (!list.length) continue;
  push(`### ${label} (${list.length})`, "", ...list.map((r) => `- \`${r.url}\``), "");
}
push(`**${routes.length} routes** in total.`, "");

push("## 4. Component inventory", "", "### Design-system components (`packages/ui`)", "");
for (const u of uiList) push(`- **${u.file}** — ${u.names.join(", ")}`);
push("", "### Application components (`apps/web/src/components`)", "");
for (const [dir, names] of Object.entries(appByDir).sort()) push(`- **${dir}/** — ${[...new Set(names)].join(", ")}`);
push("", "## 5. User journeys", "", fragment("journeys"), "", "## 6. Mock data scenarios", "");
push("Stage presets (Demo controls) — built from the documented data; values the manuals don't give are DEMO-labelled.", "", "| Preset | What it shows |", "|---|---|", ...scenarios.map((s) => `| ${s.label} | ${s.description} |`), "");
push(fragment("mock-data"), "", "## 7. Known design gaps", "", fragment("gaps"), "", "## 8. Outstanding questions", "", fragment("questions"), "");
push("## 9. Proposed backend integration points", "", fragment("integration"), "", "## 10. Verification results", "", fragment("verification"), "");
push(
  "## 11. Approval",
  "",
  "**Please review and either approve the UI or list the changes you want.** Per the project rules, no backend (NestJS, database, auth, real integrations) will be started until you explicitly approve. Any UI changes you request will be made first.",
  "",
);

fs.mkdirSync(path.join(root, "docs/review"), { recursive: true });
fs.writeFileSync(path.join(root, "docs/review/phase-1-ui-review.md"), lines.join("\n"));
console.log(`Wrote docs/review/phase-1-ui-review.md — ${screens.length} screens, ${routes.length} routes, ${scenarios.length} presets.`);
