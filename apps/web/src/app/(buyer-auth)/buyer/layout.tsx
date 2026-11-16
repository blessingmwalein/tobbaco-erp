import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Buyer Portal", template: "%s · Buyer Portal" } };

export default function BuyerAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
