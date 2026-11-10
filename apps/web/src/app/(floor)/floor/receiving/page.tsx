"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { Badge, ErrorState, Skeleton } from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { NewNoteView } from "@/components/receiving/new-note-view";
import { NoteView } from "@/components/receiving/note-view";
import { selectSaleContext } from "@/lib/sale-context";
import { useDb } from "@/mock/hooks";

function ReceivingWorkspace() {
  const router = useRouter();
  const noteId = useSearchParams().get("note");
  const ctx = useDb(selectSaleContext);
  const note = useDb((db) => (noteId ? db.transporterNotes.find((t) => t.id === noteId) : undefined));
  const open = (id: string | null) => router.replace(id ? `/floor/receiving?note=${id}` : "/floor/receiving");

  return (
    <>
      <WorkspaceHeader
        title={
          <span className="flex items-center gap-3">
            <Truck className="size-8 text-primary" aria-hidden /> Receiving
          </span>
        }
        subtitle="Transporter delivery note → growers on the truck → bale capture. Today's receiving sale date must be active."
        chips={
          <Badge tone={ctx.saleDateIsCurrent ? "success" : "danger"} dot>
            {ctx.saleDateIsCurrent ? "Sale date active" : "No active sale date"}
          </Badge>
        }
      />
      {!noteId ? (
        <NewNoteView onOpen={open} />
      ) : note ? (
        <NoteView note={note} onNew={() => open(null)} />
      ) : (
        <ErrorState title="Transporter note not found" description="It may belong to another demo state. Return to receiving to create a new note." />
      )}
    </>
  );
}

export default function FloorReceivingPage() {
  return (
    <RequirePermission permission="receiving.view">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <ReceivingWorkspace />
      </Suspense>
    </RequirePermission>
  );
}
