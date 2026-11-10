import path from "node:path";
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { jumpTo, resetDemo } from "./helpers";
import { loadScreens } from "./screens/load";

/**
 * Screenshot capture for the Phase 1 review document: `pnpm screens`.
 * Writes PNGs to docs/review/screenshots/.
 * Each module contributes a `e2e/screens/<module>.screens.ts` exporting `SCREENS: Screen[]` — add a row when a page ships.
 * `SCREENS_ONLY=dashboard,receiving` limits the run by id substring.
 */
const OUT = path.resolve(__dirname, "../../../docs/review/screenshots");

async function setRole(page: Page, roleId: string | null) {
  await page.evaluate((r) => {
    if (r) localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: `user-${r}` }, version: 0 }));
    else localStorage.removeItem("tobacco-erp-session");
  }, roleId);
}

const MANIFEST = path.resolve(__dirname, "../../../docs/review/screens.json");

/** Merge captured screens into the manifest the review-document generator reads (partial runs keep older entries). */
function writeManifest(captured: Array<{ id: string; path: string; role: string | null; scenario?: string }>) {
  let existing: Record<string, unknown> = {};
  try {
    existing = Object.fromEntries((JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Array<{ id: string }>).map((e) => [e.id, e]));
  } catch {
    /* first run */
  }
  for (const c of captured) existing[c.id] = { ...c, file: `screenshots/${c.id}.png` };
  const list = Object.values(existing as Record<string, { id: string }>).sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(MANIFEST, JSON.stringify(list, null, 2));
}

test("capture review screenshots", async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.SCREENS_ONLY?.split(",");
  const screens = await loadScreens();
  const captured: Array<{ id: string; path: string; role: string | null; scenario?: string }> = [];
  for (const s of screens) {
    if (only && !only.some((o) => s.id.includes(o))) continue;
    // Tall viewport instead of fullPage so the sticky sidebar fills the shot.
    await page.setViewportSize({ width: s.width ?? 1440, height: s.height ?? (s.tall ? 2000 : 900) });
    await resetDemo(page);
    if (s.scenario) await jumpTo(page, s.scenario);
    await setRole(page, s.role);
    await page.goto(`${s.path}${s.path.includes("?") ? "&" : "?"}latency=0`);
    if (s.waitFor) await expect(page.locator(s.waitFor).first()).toBeVisible();
    else await expect(page.locator("main, h1").first()).toBeVisible();
    if (s.before) {
      try {
        await s.before(page);
      } catch (e) {
        console.warn(`[screens] ${s.id}: setup hook failed (${String(e).split("\n")[0]}) — capturing the page as loaded`);
      }
    }
    await page.waitForTimeout(700); // let charts/animations settle
    await page.screenshot({ path: path.join(OUT, `${s.id}.png`) });
    captured.push({ id: s.id, path: s.path, role: s.role, scenario: s.scenario });
  }
  writeManifest(captured);
});
