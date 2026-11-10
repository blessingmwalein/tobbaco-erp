import { z } from "zod";

/** Form schemas for the admin screens. The mock operations (mock/domain/admin.ts) re-validate everything — like the API will. */

export const userFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});
export type UserForm = z.infer<typeof userFormSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(3, "Role name must be at least 3 characters"),
  description: z.string().trim().max(240, "Keep the description under 240 characters"),
});
export type RoleForm = z.infer<typeof roleFormSchema>;

export const settingsFormSchema = z.object({
  localCurrencyCode: z.string().trim().regex(/^[A-Za-z]{3}$/, "Three letters, e.g. ZWL"),
  rejectedSaleCodes: z.string().trim().min(1, "Keep at least one rejected sale code (RO, RH, CO are documented)"),
  unbookedPolicy: z.enum(["WARN", "BLOCK"]),
  requireDifferentBatchUser: z.boolean(),
  companyName: z.string().trim().min(1, "Company name is required"),
  debitAccount: z.string().trim().min(1, "Debit account is required"),
  bankCsvTransactionType: z.string().trim().min(1, "Transaction_Type is required"),
});
export type SettingsForm = z.infer<typeof settingsFormSchema>;
