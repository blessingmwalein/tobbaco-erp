import type { Metadata } from "next";
import { BuyerShell } from "@/components/buyer/buyer-shell";

export const metadata: Metadata = { title: { default: "Buyer Portal", template: "%s · Buyer Portal" } };

export default function BuyerPortalLayout({ children }: { children: React.ReactNode }) {
  return <BuyerShell>{children}</BuyerShell>;
}
