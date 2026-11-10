"use client";

import { Callout, PageHeader } from "@tobacco/ui";
import { AdapterCard } from "@/components/admin/adapter-card";
import { ADAPTERS } from "@/components/admin/adapters";
import { ScaleSimulator } from "@/components/admin/scale-simulator";
import { ScannerTest } from "@/components/admin/scanner-test";
import { RequirePermission } from "@/components/page-guard";

export default function DevicesPage() {
  return (
    <RequirePermission permission="admin.settings">
      <PageHeader
        title="Devices & integrations"
        description="Every external system sits behind an adapter with a defined contract. In Phase 1 all of them are labelled simulations or mocks."
      />
      <div className="flex flex-col gap-6">
        <Callout tone="warning" title="Nothing on this page is connected to real hardware, a bank or TIMB">
          The ERP core talks only to ports it owns; each provider is an adapter behind a port. Mock adapters identify themselves in the UI and in logs, and a
          physical device is never shown as connected unless a real adapter reports it. Credentials and decryption keys live outside source code.
        </Callout>
        <section aria-label="Adapters" className="grid gap-4 xl:grid-cols-2">
          {ADAPTERS.map((a) => (
            <AdapterCard key={a.id} adapter={a} />
          ))}
        </section>
        <div className="grid gap-6 xl:grid-cols-2">
          <ScaleSimulator />
          <ScannerTest />
        </div>
      </div>
    </RequirePermission>
  );
}
