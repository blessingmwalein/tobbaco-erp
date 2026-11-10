import { confirmPost, initiateNote, scan, TICKETS } from "../dispatch.helpers";
import type { Screen } from "./types";

/** Review screenshots for Floor Dispatch (Manual 09). Ids are prefixed 8x so they sort together. */
export const SCREENS: Screen[] = [
  {
    id: "80-dispatch-floor-initiate",
    path: "/floor/dispatch",
    role: "dispatch-clerk",
    scenario: "READY_TO_DISPATCH",
    tall: true,
  },
  {
    // Scanning workspace mid-load: 3 bales on the note, plus one refusal in the history
    id: "81-dispatch-floor-scanning",
    path: "/floor/dispatch",
    role: "dispatch-clerk",
    scenario: "READY_TO_DISPATCH",
    tall: true,
    before: async (page) => {
      await initiateNote(page);
      for (const t of TICKETS.slice(0, 3)) await scan(page, t);
      await scan(page, "1000009999");
    },
  },
  {
    // Wrong-warehouse refusal (note for DEMOWH2, JM bale scanned)
    id: "82-dispatch-floor-refused",
    path: "/floor/dispatch",
    role: "dispatch-clerk",
    scenario: "READY_TO_DISPATCH",
    before: async (page) => {
      await initiateNote(page, { warehouse: "DEMOWH2" });
      await scan(page, "1000001013");
    },
  },
  {
    // Loaded, marked Done, posted — shipment file generated (supervisor-level role holds every dispatch permission)
    id: "83-dispatch-floor-posted",
    path: "/floor/dispatch",
    role: "demo-operator",
    scenario: "READY_TO_DISPATCH",
    tall: true,
    before: async (page) => {
      await initiateNote(page);
      for (const t of TICKETS) await scan(page, t);
      await page.getByTestId("done-loading").click();
      await confirmPost(page);
      await page.getByTestId("generate-shipment").click();
      await page.getByText(/Shipment file .* generated/).waitFor();
    },
  },
  {
    id: "84-dispatch-notes-list",
    path: "/floor/dispatch",
    role: "demo-operator",
    scenario: "READY_TO_DISPATCH",
    tall: true,
    before: async (page) => {
      // one posted note and one draft note, then show the back-office list
      await initiateNote(page);
      for (const t of TICKETS.slice(0, 3)) await scan(page, t);
      await page.getByTestId("done-loading").click();
      await confirmPost(page);
      await initiateNote(page, { truckReg: "ZAC 9876" });
      await scan(page, TICKETS[3]);
      await page.goto("/dispatch?latency=0");
      await page.getByTestId("dispatch-notes-table").waitFor();
      await page.getByText("FLDN/2026/09/0002").first().waitFor();
    },
  },
  {
    id: "85-dispatch-note-detail",
    path: "/floor/dispatch",
    role: "demo-operator",
    scenario: "READY_TO_DISPATCH",
    tall: true,
    before: async (page) => {
      await initiateNote(page);
      for (const t of TICKETS) await scan(page, t);
      await page.getByTestId("done-loading").click();
      await confirmPost(page);
      await page.getByTestId("generate-shipment").click();
      await page.getByText(/Shipment file .* generated/).waitFor();
      await page.goto("/dispatch/dispatch-1?latency=0");
      await page.getByTestId("detail-bales-table").waitFor();
    },
  },
  {
    id: "86-dispatch-shipment-files",
    path: "/floor/dispatch",
    role: "demo-operator",
    scenario: "READY_TO_DISPATCH",
    before: async (page) => {
      await initiateNote(page);
      for (const t of TICKETS) await scan(page, t);
      await page.getByTestId("done-loading").click();
      await confirmPost(page);
      await page.getByTestId("generate-shipment").click();
      await page.getByText(/Shipment file .* generated/).waitFor();
      await page.goto("/dispatch/shipments?latency=0");
      await page.getByTestId("shipments-table").waitFor();
      await page.getByRole("button", { name: /Preview FLDN_2026_09_0001.csv/ }).click();
      await page.getByTestId("csv-preview").waitFor();
    },
  },
  {
    id: "87-dispatch-empty-list",
    path: "/dispatch",
    role: "dispatch-supervisor",
    scenario: "READY_TO_DISPATCH",
  },
];
