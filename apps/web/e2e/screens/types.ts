import type { Page } from "@playwright/test";
import type { ScenarioId } from "../helpers";

export interface Screen {
  /** File name, e.g. "20-receiving-bale-capture". Prefix numbers keep the review document ordered. */
  id: string;
  path: string;
  /** Demo role id (e.g. "receiving-clerk") or null for signed out. */
  role: string | null;
  scenario?: ScenarioId;
  width?: number;
  height?: number;
  /** Use a 2000px-tall viewport for long pages. */
  tall?: boolean;
  /** Selector that must be visible before the shot. */
  waitFor?: string;
  /** Optional interaction before the shot (open a dialog, scan a barcode…). */
  before?: (page: Page) => Promise<void>;
}
