import { describe, expect, it } from "vitest";
import { activateAccountSchema, emailSchema, forgotPasswordSchema, loginSchema, passwordPolicyIssues, resetPasswordSchema } from "./auth";

describe("password policy", () => {
  it("accepts a reasonable password", () => {
    expect(passwordPolicyIssues("Demo-Tobacco-2026")).toEqual([]);
  });
  it("lists every problem", () => {
    expect(passwordPolicyIssues("short")).toEqual(expect.arrayContaining(["Use at least 10 characters", "Include at least one number"]));
    expect(passwordPolicyIssues("1234567890123")).toContain("Include at least one letter");
    expect(passwordPolicyIssues("password123")).toContain("That password is too common");
  });
  it("rejects a password containing the email name", () => {
    expect(passwordPolicyIssues("tafara-2026-abc", { email: "tafara@moroz.test" })).toContain("Do not include your email name");
    expect(passwordPolicyIssues("tafara-2026-abc", { email: "ab@moroz.test" })).toEqual([]); // too short a name to matter
  });
});

describe("auth schemas", () => {
  it("normalises email (trim + lowercase) and rejects malformed ones", () => {
    expect(emailSchema.parse("  Admin@Moroz-Demo.TEST ")).toBe("admin@moroz-demo.test");
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
  it("login does not apply the password policy (a policy change must not lock people out)", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
  it("forgot-password defaults to the buyer audience", () => {
    expect(forgotPasswordSchema.parse({ email: "a@b.co" }).audience).toBe("BUYER");
  });
  it("reset and activation enforce the policy on the new password", () => {
    const token = "t".repeat(30);
    expect(resetPasswordSchema.safeParse({ token, password: "weak" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token, password: "Strong-Pass-2026" }).success).toBe(true);
    expect(activateAccountSchema.safeParse({ token, password: "Strong-Pass-2026" }).success).toBe(true);
    expect(activateAccountSchema.safeParse({ token: "short", password: "Strong-Pass-2026" }).success).toBe(false);
  });
});
