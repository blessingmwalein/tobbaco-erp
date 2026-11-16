import type { DecimalString, IsoDateString, Page } from "./common";
export interface ProcessingCompanyDto { id: string; name: string; registrationNo: string | null; address: string | null; contactPerson: string | null; phone: string | null; email: string | null; active: boolean; createdAt: IsoDateString; }
export interface DispatchBaleDto { id: string; baleId: string; barcode: string; massKgAtDispatch: DecimalString; status: string; sourceWarehouseId: string | null; sourceBayId: string | null; sourceRowId: string | null; }
export interface DispatchDto { id: string; reference: string; processingCompany: { id: string; name: string }; dispatchDate: IsoDateString; reason: string; notes: string | null; status: string; totalBales: number; totalMassKg: DecimalString; createdAt: IsoDateString; bales?: DispatchBaleDto[]; }
export type ProcessingCompanyPage = Page<ProcessingCompanyDto>;
export type DispatchPage = Page<DispatchDto>;
