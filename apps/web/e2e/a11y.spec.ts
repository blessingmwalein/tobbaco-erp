import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { jumpTo, resetDemo } from "./helpers";
import { loadScreens } from "./screens/load";

/**
 * Accessibility sweep: axe-core (WCAG 2.0/2.1 A + AA) over every screen that has a screenshot entry.
 * Fails on serious/critical violations. `A11Y_ONLY=sale,dispatch` limits by id substring.
 */
async function setRole(page: Page, roleId: string | null) {
  await page.evaluate((r) => {
    if (r) localStorage.setItem("tobacco-erp-session", JSON.stringify({ state: { userId: `user-${r}` }, version: 0 }));
    else localStorage.removeItem("tobacco-erp-session");
  }, roleId);
}

test("axe: no serious or critical WCAG A/AA violations on any screen", async ({ page }) => {
  test.setTimeout(900_000);
  const only = process.env.A11Y_ONLY?.split(",");
  const screens = await loadScreens();
  const problems: string[] = [];
  for (const s of screens) {
    if (only && !only.some((o) => s.id.includes(o))) continue;
    await page.setViewportSize({ width: s.width ?? 1440, height: 900 });
    await resetDemo(page);
    if (s.scenario) await jumpTo(page, s.scenario);
    await setRole(page, s.role);
    await page.goto(`${s.path}${s.path.includes("?") ? "&" : "?"}latency=0`);
    await expect(page.locator("main, h1").first()).toBeVisible();
    if (s.before) {
      try {
        await s.before(page);
      } catch (e) {
        problems.push(`${s.id}: screen setup hook failed — ${String(e).split("\n")[0]}`);
        continue;
      }
    }
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of results.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
      const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ");
      problems.push(`${s.id}: [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s)) e.g. ${nodes}`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
