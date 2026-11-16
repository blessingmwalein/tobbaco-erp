export interface WarehouseDto { id: string; code: string; name: string; kind: "STANDARD" | "PROCESSING"; address: string | null; active: boolean; }
export interface BayDto { id: string; warehouseId: string; code: string; name: string | null; active: boolean; }
export interface WarehouseRowDto { id: string; bayId: string; code: string; capacityBales: number | null; active: boolean; }
