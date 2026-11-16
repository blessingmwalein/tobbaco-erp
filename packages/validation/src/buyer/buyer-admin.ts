import { z } from "zod";
import { BUYER_ROLE_IDS } from "@tobacco/shared";
import { emailSchema } from "./auth";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

/** The buyer code printed on the floor documents, e.g. MZ. */
export const orgCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,6}$/, "Use 2–6 letters or digits (the buyer code on the floor)");

export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  registrationNo: optionalText(60),
  address: optionalText(300),
  contactPerson: optionalText(100),
  phone: optionalText(40),
  email: z
    .union([z.literal(""), emailSchema])
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const buyerRoleSchema = z.enum(BUYER_ROLE_IDS);
export const buyerRolesSchema = z
  .array(buyerRoleSchema)
  .min(1, "Choose at least one role")
  .transform((roles) => [...new Set(roles)]);

export const createBuyerUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(100),
  email: emailSchema,
  roles: buyerRolesSchema,
});
export type CreateBuyerUserInput = z.infer<typeof createBuyerUserSchema>;

export const updateBuyerUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    roles: buyerRolesSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type UpdateBuyerUserInput = z.infer<typeof updateBuyerUserSchema>;

/** ERP staff creates a buyer company together with its first administrator. */
export const createOrganisationSchema = companyProfileSchema.extend({
  code: orgCodeSchema,
  admin: z.object({ name: z.string().trim().min(2, "Administrator name is required").max(100), email: emailSchema }),
});
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const setOrganisationStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
  reason: z.string().trim().min(3, "Give a short reason").max(300).optional(),
});
export type SetOrganisationStatusInput = z.infer<typeof setOrganisationStatusSchema>;
