"use client";

import { Suspense } from "react";
import { Skeleton } from "@tobacco/ui";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";
import { ReportWorkbench } from "@/components/buyer/reports/report-workbench";

export default function ReceivingReportsPage() {
  return (
    <RequireBuyerPermission permission="buyer.reports.view">
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ReportWorkbench area="receiving" />
      </Suspense>
    </RequireBuyerPermission>
  );
}
