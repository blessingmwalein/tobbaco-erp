"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  DateInput,
  EmptyState,
  Field,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@tobacco/ui";
import { formatDate } from "@tobacco/shared";
import { normaliseGrowerNo } from "@tobacco/validation";
import { RequirePermission } from "@/components/page-guard";
import { WorkspaceHeader } from "@/components/floor/workspace";
import { useDb, useDbQuery } from "@/mock/hooks";
import { checkFloorSummary } from "@/mock/domain/floor-summary";

/** Check Floor Summary (Manual 05, Step 3): answers "where are this grower's bales?". */
export default function CheckFloorSummaryPage() {
  const today = useDb((db) => db.settings.demoToday);
  const [date, setDate] = useState(today);
  const [growerNo, setGrowerNo] = useState("");
  const [submitted, setSubmitted] = useState<{ date: string; growerNo: string } | null>(null);
  const { data, isFetching } = useDbQuery(["floor-summary-check", submitted], (db) => checkFloorSummary(db, submitted!), { enabled: submitted !== null });

  return (
    <RequirePermission permission="floor-summary.view">
      <WorkspaceHeader
        title="Check Floor Summary"
        subtitle="Find where a grower's bales are on the floor."
        actions={
          <Button asChild variant="secondary">
            <Link href="/floor/floor-summary">
              <ArrowLeft /> Back to Floor Summary
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardContent className="p-6">
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted({ date, growerNo: normaliseGrowerNo(growerNo) });
              }}
            >
              <Field label="Selling Date" htmlFor="check-date" required>
                <DateInput id="check-date" size="lg" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Grower Number" htmlFor="check-grower" required hint="e.g. V100060 (the V is added for you)">
                <Input id="check-grower" size="lg" placeholder="V100060" value={growerNo} onChange={(e) => setGrowerNo(e.target.value)} autoFocus data-testid="check-grower" />
              </Field>
              <Button type="submit" size="lg" disabled={!growerNo.trim()} data-testid="check-submit">
                <Search /> Search Floor Summary for Grower
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2" data-testid="check-result">
          <CardContent className="p-6">
            {!submitted ? (
              <EmptyState icon={Search} title="Enter a grower number" description="You'll see the row(s), groups and total bales for that day." />
            ) : isFetching && !data ? (
              <p className="text-sm text-muted-foreground">Searching…</p>
            ) : data && data.found ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    Grower {data.growerNo} {data.growerName}
                  </p>
                  <p className="text-sm text-muted-foreground">Sales on {formatDate(data.date)}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row(s)</TableHead>
                      <TableHead>Groups</TableHead>
                      <TableHead>Total Bales</TableHead>
                      <TableHead>Selling Time</TableHead>
                      <TableHead>Delivery note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.summaries.map((s) => (
                      <TableRow key={s.gdnDocNo}>
                        <TableCell className="text-lg font-semibold">{s.rows.join(", ")}</TableCell>
                        <TableCell>{s.groups}</TableCell>
                        <TableCell className="tabular">{s.totalBales}</TableCell>
                        <TableCell className="tabular text-muted-foreground">{s.sellingTime ?? "—"}</TableCell>
                        <TableCell className="font-mono text-[13px]">{s.gdnDocNo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                title={`No floor summary for ${submitted.growerNo}`}
                description={`${formatDate(submitted.date)}: no completed floor summary for this grower. The delivery may still be scanning, or the grower did not deliver that day.`}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </RequirePermission>
  );
}
