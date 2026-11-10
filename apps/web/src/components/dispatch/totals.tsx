import { Card } from "@tobacco/ui";

/** Big floor-friendly number card (bales, total mass). */
export function BigNumberCard({
  label,
  value,
  unit,
  hint,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5" data-testid={testId}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="tabular text-5xl font-semibold leading-none tracking-tight" aria-live="polite">
        {value}
        {unit ? <span className="ml-2 text-2xl font-medium text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
