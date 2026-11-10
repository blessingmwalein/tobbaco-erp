import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { MockProvider } from "@/mock/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tobacco ERP", template: "%s · Tobacco ERP" },
  description: "Zimbabwe tobacco floor operations — receiving to dispatch. Phase 1 UI preview on mocked data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7201ff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <MockProvider>{children}</MockProvider>
      </body>
    </html>
  );
}
