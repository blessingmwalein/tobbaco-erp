export interface ReceivingSessionDto { id: string; purchaseId: string; reference: string; status: string; startedAt: string; confirmedAt: string | null; reconciliation?: unknown; }
export interface ReceivingScanDto { id: string; sessionId: string; barcode: string; result: string; baleId: string | null; scannedAt: string; }
