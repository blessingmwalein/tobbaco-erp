import { centsToDecimalString, formatLocal, formatUsd } from "@tobacco/shared";

/** USD cents → "$499.43"; local-currency minor units → "ZWL 1,332,583.56". */
export function formatMoney(cents: number, currency: string): string {
  return currency === "USD" ? formatUsd(cents) : formatLocal(centsToDecimalString(cents), currency);
}
