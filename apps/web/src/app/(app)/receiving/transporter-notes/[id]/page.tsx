"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  KeyValue,
  PageHeader,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tobacco/ui";
import { formatDateTime } from "@tobacco/shared";
import { RequirePermission } from "@/components/page-guard";
import { StatusBadge } from "@/components/domain/status-badge";
import { GdnLink, GrowerLink } from "@/components/domain/entity-links";
import { AuditTimeline } from "@/components/receiving/audit-timeline";
import { userName } from "@/mock/ctx";
import { deliveryTally } from "@/mock/domain/receiving";
import { useDbQuery } from "@/mock/hooks";

export default function TransporterNoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useDbQuery(["transporter-note", id], (db) => {
    const note = db.transporterNotes.find((t) => t.id === id);
    if (!note) return null;
    const lines = note.growers.map((line) => {
      const gdn = line.gdnId ? db.deliveryNotes.find((d) => d.id === line.gdnId) : undefined;
      const g = db.growers.find((x) => x.growerNo === line.growerNo);
      return { line, gdn, name: g ? `${g.surname} ${g.firstName}` : "—", tally: gdn ? deliveryTally(db, gdn) : undefined };
    });
    return { note, lines, createdBy: userName(db, note.createdBy) };
  });

  return (
    <RequirePermission permission="receiving.view">
      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !data ? (
        <ErrorState title="Transporter note not found" description="It may belong to a different demo state." action={<Button asChild variant="secondary"><Link href="/receiving/transporter-notes">Back to the list</Link></Button>} />
      ) : (
        <>
          <PageHeader
            title={<span className="font-mono">{data.note.docNo}</span>}
            description={`${data.note.transporterName} · ${data.note.vehicleReg}`}
            badges={<StatusBadge kind="transporterNote" value={data.note.state} />}
            actions={
              <Button asChild variant="secondary">
                <Link href={`/floor/receiving?note=${data.note.id}`}>
                  Open in Receiving <ExternalLink />
                </Link>
              </Button>
            }
          />
          <div className="flex flex-col gap-6">
            <Card>
              <CardContent className="pt-5">
                <KeyValue
                  columns={4}
                  items={[
                    { label: "Transporter", value: data.note.transporterName },
                    { label: "ID Number", value: data.note.idNumber },
                    { label: "Vehicle Reg", value: <span className="font-mono">{data.note.vehicleReg}</span> },
                    { label: "Phone", value: data.note.phone },
                    { label: "Permit No.", value: data.note.permitNo || "—" },
                    { label: "Growers", value: data.note.growers.length },
                    { label: "Total bales", value: data.note.growers.reduce((a, g) => a + g.bales, 0) },
                    { label: "Created", value: `${formatDateTime(data.note.createdAt)} · ${data.createdBy}` },
                    { label: "Completed", value: formatDateTime(data.note.completedAt) },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Growers on this truck</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0 pt-3">
                <Table aria-label="Growers on the transporter note" data-testid="tdn-growers">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grower #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Loc</TableHead>
                      <TableHead className="text-right">Declared</TableHead>
                      <TableHead>Delivery note</TableHead>
                      <TableHead className="text-right">Captured</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lines.map(({ line, gdn, name, tally }, i) => (
                      <TableRow key={`${line.growerNo}-${i}`}>
                        <TableCell><GrowerLink growerNo={line.growerNo} /></TableCell>
                        <TableCell>{name}</TableCell>
                        <TableCell>{line.location}</TableCell>
                        <TableCell className="tabular text-right">{line.bales}</TableCell>
                        <TableCell>{gdn ? <GdnLink id={gdn.id} docNo={gdn.docNo} /> : <span className="text-muted-foreground">Created on completion</span>}</TableCell>
                        <TableCell className="tabular text-right">{tally ? `${tally.captured} of ${tally.declared}` : "—"}</TableCell>
                        <TableCell>{gdn ? <StatusBadge kind="deliveryNote" value={gdn.state} /> : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <AuditTimeline entityIds={[data.note.id, ...data.lines.flatMap((l) => (l.gdn ? [l.gdn.id] : []))]} />
          </div>
        </>
      )}
    </RequirePermission>
  );
}
