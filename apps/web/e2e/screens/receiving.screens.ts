import type { Screen } from "./types";

/** Receiving (Manual 03) and ticket printing (Manual 04). */
export const SCREENS: Screen[] = [
  { id: "20-receiving-transporter-note", path: "/floor/receiving", role: "receiving-clerk", scenario: "BOOKINGS_IMPORTED", tall: true },
  { id: "21-receiving-bale-capture", path: "/floor/receiving/gdn-0000005/bales", role: "receiving-clerk", scenario: "RECEIVING_IN_PROGRESS", tall: true },
  { id: "22-delivery-notes", path: "/receiving/delivery-notes", role: "receiving-supervisor", scenario: "TICKETS_CONFIRMED" },
  { id: "23-delivery-note-detail", path: "/receiving/delivery-notes/gdn-0000005", role: "receiving-supervisor", scenario: "TICKETS_CONFIRMED", tall: true },
  { id: "24-transporter-notes", path: "/receiving/transporter-notes", role: "receiving-supervisor", scenario: "RECEIVED" },
  { id: "25-receiving-corrections", path: "/receiving/corrections", role: "receiving-supervisor", scenario: "RECEIVED" },
  { id: "30-tickets-queue", path: "/floor/tickets", role: "ticket-clerk", scenario: "RECEIVED" },
  { id: "31-ticket-printing", path: "/floor/tickets/gdn-0000005", role: "ticket-clerk", scenario: "RECEIVED", tall: true },
  { id: "32-ticket-confirmed", path: "/floor/tickets/gdn-0000005", role: "ticket-clerk", scenario: "TICKETS_CONFIRMED", tall: true },
  { id: "33-tickets-overview", path: "/tickets", role: "ticket-clerk", scenario: "TICKETS_CONFIRMED" },
];
