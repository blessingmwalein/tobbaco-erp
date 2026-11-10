"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/page-guard";
import { TicketWorkspace } from "@/components/tickets/ticket-workspace";

export default function TicketDeliveryPage() {
  const { gdn } = useParams<{ gdn: string }>();
  return (
    <RequirePermission permission="tickets.view">
      <TicketWorkspace gdnId={decodeURIComponent(gdn)} />
    </RequirePermission>
  );
}
