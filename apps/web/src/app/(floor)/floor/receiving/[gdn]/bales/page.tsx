"use client";

import { useParams } from "next/navigation";
import { RequirePermission } from "@/components/page-guard";
import { BaleCaptureWorkspace } from "@/components/receiving/bale-capture";

export default function BaleCapturePage() {
  const { gdn } = useParams<{ gdn: string }>();
  return (
    <RequirePermission permission="receiving.view">
      <BaleCaptureWorkspace gdnId={decodeURIComponent(gdn)} />
    </RequirePermission>
  );
}
