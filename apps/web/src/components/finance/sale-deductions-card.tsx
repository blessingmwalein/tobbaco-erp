import { Badge, Card, CardContent, CardHeader, CardTitle, DemoBadge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@tobacco/ui";
import { DEDUCTION_SOURCE_LABEL, formatUsd, type DeductionSource } from "@tobacco/shared";
import { formatMoney } from "./money";

export interface DeductionLineView {
  key: string;
  sequence: number;
  source: DeductionSource;
  creditorName: string;
  description: string;
  amountCents: number;
  currency: string;
  isDemoAmount?: boolean;
}

/** One sale's gross → deductions (in the documented order) → net payout. Used for the preview and the result. */
export function SaleDeductionsCard({
  title,
  subtitle,
  grossCents,
  lines,
  capped,
  badge,
  testId,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  grossCents: number;
  lines: DeductionLineView[];
  capped?: boolean;
  badge?: React.ReactNode;
  testId?: string;
}) {
  const total = lines.reduce((a, l) => a + l.amountCents, 0);
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {title}
            {badge}
            {capped ? <Badge tone="warning">Limited to sale value · UQ-22</Badge> : null}
          </CardTitle>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Creditor</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={4} className="font-medium">
                Gross sale value
              </TableCell>
              <TableCell className="tabular text-right font-medium">{formatUsd(grossCents)}</TableCell>
            </TableRow>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No deductions
                </TableCell>
              </TableRow>
            ) : (
              lines.map((l) => (
                <TableRow key={l.key} data-testid="deduction-line" data-sequence={l.sequence}>
                  <TableCell className="tabular text-muted-foreground">{l.sequence}</TableCell>
                  <TableCell className="text-muted-foreground">{DEDUCTION_SOURCE_LABEL[l.source]}</TableCell>
                  <TableCell>{l.creditorName}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      {l.description}
                      {l.isDemoAmount ? <DemoBadge>DEMO AMOUNT</DemoBadge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="tabular text-right">− {formatMoney(l.amountCents, l.currency)}</TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-surface-secondary">
              <TableCell colSpan={4} className="text-muted-foreground">
                Total deductions
              </TableCell>
              <TableCell className="tabular text-right">− {formatUsd(total)}</TableCell>
            </TableRow>
            <TableRow className="bg-surface-secondary">
              <TableCell colSpan={4} className="font-semibold">
                Net grower payout
              </TableCell>
              <TableCell className="tabular text-right text-base font-semibold" data-testid="net-payout">
                {formatUsd(grossCents - total)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
