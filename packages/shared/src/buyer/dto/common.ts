/** Wire types shared by the API and the web app (JSON over HTTP). Dates are ISO-8601 strings; money and weights are decimal STRINGS (never floats). */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

/** Tenant-safe "label + id" reference to another record. */
export interface RefDto {
  id: string;
  label: string;
}

export type DecimalString = string;
export type IsoDateString = string;
