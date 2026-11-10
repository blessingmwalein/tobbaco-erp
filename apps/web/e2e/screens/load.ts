import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Screen } from "./types";

/** Loads every `*.screens.ts` module in this folder (one per feature slice) and returns the combined, sorted list. */
export async function loadScreens(): Promise<Screen[]> {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".screens.ts")).sort();
  const all: Screen[] = [];
  for (const f of files) {
    const mod = (await import(pathToFileURL(path.join(__dirname, f)).href)) as { SCREENS: Screen[] };
    all.push(...mod.SCREENS);
  }
  return all.sort((a, b) => a.id.localeCompare(b.id));
}
