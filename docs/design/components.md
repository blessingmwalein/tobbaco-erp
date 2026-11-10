# Component Inventory

Foundation: shadcn/ui, customised into one coherent system, placed in `packages/ui`. Business logic stays out of components (pure functions in `src/domain`, services via TanStack Query hooks).

## Foundation (customised shadcn/ui)
Button, Input, Select, Combobox, Textarea, Checkbox, Switch, Radio, Date picker, Dialog, Alert dialog (confirm), Dropdown menu, Context menu, Popover, Tooltip, Tabs, Badge, Card, Table (TanStack Table), Pagination, Breadcrumb, Command palette (global search), Toast (sonner), Skeleton, Empty state, Error state, Progress, Sheet/Drawer, Avatar, Separator, Scroll area, Form (React Hook Form + Zod).

## Shared enterprise components
| Component | Purpose |
|---|---|
| `DataTable` | Sorting, filtering, global search, pagination, column visibility, row selection, bulk actions, status badges, context menu, row-detail navigation, loading skeleton, empty state |
| `FilterBar` / `DateRangePicker` | Date range, season, selling point, grower, buyer, creditor, batch, status filters |
| `StatusBadge` | One badge for all states (GDN, sale, batch, dispatch, import, payment) |
| `DemoBadge`, `UnverifiedBadge`, `SimulatedBadge` | Flag demo records, unconfirmed rules (UQ-xx link), mocked devices |
| `KpiCard`, `TrendChart`, `BarList` | Dashboard metrics and charts (only where operationally meaningful) |
| `StageStepper` / `SaleDayPipeline` | Sale-day lifecycle with active/completed/blocked/waiting and blocker reasons |
| `Timeline` | Record history/audit |
| `PermissionGate` | Hide/disable with "Requires permission X" |
| `ConfirmDialog` | Destructive/irreversible actions with reason field when required |
| `ReasonDialog` | Mandatory reason capture (eject, reverse printing, cancel, reset) |
| `MessageBanner` | Verbatim documented messages (error/warning/success) |
| `ImportWizard` | Type → upload → validate → preview → confirm → result (created/updated/errors) → row errors |
| `PrintPreview` | Ticket / sales sheet preview, printer-friendly CSS |
| `CsvDownload` | Client-side demo file generation |

## Floor / scanner components
| Component | Purpose |
|---|---|
| `BarcodeScannerInput` | Auto-focus, Enter submit, Tab navigation, duplicate detection, valid/invalid feedback, history |
| `LastScanPanel` | Last grower/barcode/lot/group with success/error colour and icon |
| `TallyBadge` | "Scanned N of M", "Bale Tally N of M", "Delivery Balanced" |
| `ScanHistoryList` | Recent scans with result |
| `ScanSimulator` | Chips of expected barcodes + rapid multi-line paste (Phase 1 only) |
| `ScaleFeedPanel` | Simulated weigh events ("Not connected — simulated") |
| `StationHeader` | Purple floor top bar: station name, sale date, selling point, user, device status |

## Domain widgets (back office)
`GrowerCard`, `BookingTable`, `TransporterNoteForm`, `GrowerDeliveryPanel`, `TicketAllocationTable`, `FloorRowSummary`, `ClassificationForm`, `BuyingForm`, `PriceBatchGrid` (blind batch price cells), `BalancingPreview` (every check listed), `DeductionLedger`, `DeductionsDashboard`, `PaymentScheduleTable`, `ReconciliationPanel`, `DispatchScanPanel`, `PermissionMatrixEditor`.

## States every screen must handle
Loading (skeleton), empty (explain + primary action), error (message + retry), no-permission, success (toast + visible state change), validation (inline, verbatim documented text), large datasets (pagination/virtualised scan history).

Sources: brief Parts 3, 13; Manuals 03–09 (workflows).
