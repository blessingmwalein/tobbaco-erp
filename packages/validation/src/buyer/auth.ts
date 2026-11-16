import { z } from "zod";

/**
 * Buyer Portal authentication schemas + the password policy — shared by the web forms and the API,
 * so both enforce exactly the same rules (the API is authoritative).
 */
export const PASSWORD_MIN_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  "password123",
  "password1234",
  "1234567890",
  "qwerty12345",
  "letmein1234",
  "welcome1234",
  "tobacco1234",
  "admin12345",
  "passw0rd123",
]);

/** Human-readable reasons a password is rejected (empty array = acceptable). */
export function passwordPolicyIssues(password: string, ctx: { email?: string; name?: string } = {}): string[] {
  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[A-Za-z]/.test(password)) issues.push("Include at least one letter");
  if (!/\d/.test(password)) issues.push("Include at least one number");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) issues.push("That password is too common");
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) issues.push("Do not include your email name");
  return issues;
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Email is required")
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address");

/** New-password field: applies the policy. */
export const newPasswordSchema = z.string().superRefine((value, ctx) => {
  for (const message of passwordPolicyIssues(value)) ctx.addIssue({ code: "custom", message });
});

export const loginSchema = z.object({
  email: emailSchema,
  /** Not policy-checked on login (a policy change must not lock people out). */
  password: z.string().min(1, "Password is required").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  /** Which kind of account — the buyer portal and the ERP staff console are separate. */
  audience: z.enum(["BUYER", "STAFF"]).default("BUYER"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset link is invalid"),
  password: newPasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const activateAccountSchema = z.object({
  token: z.string().min(20, "Activation link is invalid"),
  password: newPasswordSchema,
});
export type ActivateAccountInput = z.infer<typeof activateAccountSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: newPasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
