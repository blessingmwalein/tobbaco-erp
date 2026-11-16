import type { DecimalString, IsoDateString, Page } from "./common";
export interface ReturnBaleDto { id: string; scannedBarcode: string; outcome: string; returnedMassKg: DecimalString | null; explanation: string | null; newBaleId: string | null; }
export interface ProcessingReturnDto { id: string; reference: string; dispatchId: string; status: string; startedAt: IsoDateString; confirmedAt: IsoDateString | null; reconciliation: unknown; bales?: ReturnBaleDto[]; }
export type ProcessingReturnPage = Page<ProcessingReturnDto>;
