"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DemoBadge,
  Field,
  Input,
  NativeSelect,
  ProgressBar,
  UnverifiedBadge,
  type ScanOutcome,
} from "@tobacco/ui";
import { RequirePermission } from "@/components/page-guard";
import { ScanPanel, WorkspaceHeader } from "@/components/floor/workspace";
import { PermissionButton, useCan } from "@/lib/permissions";
import { useAction, useDb } from "@/mock/hooks";
import {
  HESSIAN_OWNERS,
  lookupBale,
  saveAllDetails,
  saveBuying,
  saveClassification,
  selectCaptureQueue,
  type BaleCaptureView,
  type CaptureField,
  type CaptureSaveResult,
} from "@/mock/domain/data-capture";

export type CaptureMode = "classification" | "buying" | "all";

const MODE: Record<CaptureMode, { title: string; blurb: string; permission: "data-capture.classify" | "data-capture.capture-buyer" }> = {
  classification: {
    title: "Classification",
    blurb: "Scan the ticket, enter the TIMB grade or reason and the hessian owner.",
    permission: "data-capture.classify",
  },
  buying: {
    title: "e-Buying",
    blurb: "Scan the ticket, enter buyer, buyer grade and price (US cents per kg). Sale code only for a bale that wasn't bought.",
    permission: "data-capture.capture-buyer",
  },
  all: {
    title: "All Details",
    blurb: "Classification and e-Buying on one form.",
    permission: "data-capture.classify",
  },
};

interface FormState {
  timbGrade: string;
  hessianOwner: string;
  buyer: string;
  buyerGrade: string;
  price: string;
  saleCode: string;
}

const FIELD_LABEL: Record<CaptureField, string> = {
  timbGrade: "TIMB Grade / Reason",
  hessianOwner: "Hessian",
  buyer: "Buyer",
  buyerGrade: "Buyer Grade",
  price: "Price",
  saleCode: "Sale Code",
};

export function CaptureStation({ mode }: { mode: CaptureMode }) {
  const meta = MODE[mode];
  const [current, setCurrent] = useState<BaleCaptureView | null>(null);
  const [last, setLast] = useState<BaleCaptureView | null>(null);
  const lookup = useAction(lookupBale, { latency: 30, silent: true });
  const queue = useDb(selectCaptureQueue);

  const onScan = useCallback(
    async (barcode: string): Promise<ScanOutcome> => {
      const res = await lookup.run({ barcode });
      if (!res.ok) return { ok: false, message: res.error.message };
      setCurrent(res.data);
      return { ok: true, message: `${res.data.growerNo} · ${res.data.mass} kg · group ${res.data.group} lot ${res.data.lot}` };
    },
    [lookup],
  );

  const simulate = queue.slice(0, 12).map((q) => ({
    value: q.barcode,
    hint: q.complete ? `${q.growerNo} — complete (re-scan to edit)` : `${q.growerNo} — needs ${q.missing.join(", ")}`,
  }));
  const done = queue.filter((q) => q.complete).length;

  return (
    <RequirePermission permission={meta.permission}>
      <WorkspaceHeader
        title={meta.title}
        subtitle={meta.blurb}
        chips={<Badge tone="primary">Data capture</Badge>}
        actions={
          <Button asChild variant="secondary">
            <Link href="/floor/data-capture">
              <ArrowLeft /> Stations
            </Link>
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {current ? (
            <CaptureForm
              key={current.barcode}
              mode={mode}
              view={current}
              onCancel={() => setCurrent(null)}
              onSaved={(v) => {
                setLast(v);
                setCurrent(null);
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-6">
                <ScanPanel
                  scope={`capture-${mode}`}
                  label={mode === "buying" ? "Scan Barcode - buy" : "Scan ticket barcode"}
                  placeholder="Scan ticket barcode…"
                  submitLabel="Scan"
                  onScan={onScan}
                  simulate={simulate}
                />
              </CardContent>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <LastBaleDetails view={last} />
          <Card>
            <CardHeader>
              <CardTitle>Draft sales progress</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <p className="tabular text-3xl font-semibold">
                {done} <span className="text-lg font-medium text-muted-foreground">of {queue.length} bales complete</span>
              </p>
              <ProgressBar value={done} max={queue.length} tone={done === queue.length && queue.length > 0 ? "success" : "primary"} label="Bales captured" />
              <p className="text-xs text-muted-foreground">Complete = TIMB grade, buyer, buyer grade and price (or a sale code with a reason).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </RequirePermission>
  );
}

function CaptureForm({
  mode,
  view,
  onCancel,
  onSaved,
}: {
  mode: CaptureMode;
  view: BaleCaptureView;
  onCancel: () => void;
  onSaved: (v: BaleCaptureView) => void;
}) {
  const can = useCan();
  const db = useDb((d) => ({ grades: d.timbGrades, buyers: d.buyers }));
  const [f, setF] = useState<FormState>({
    timbGrade: view.timbGrade ?? "",
    hessianOwner: view.hessianOwner ?? "",
    buyer: view.buyerCode ?? "",
    buyerGrade: view.buyerGrade ?? "",
    price: view.priceCents ? String(view.priceCents) : "",
    saleCode: view.saleCode ?? "",
  });
  const [result, setResult] = useState<CaptureSaveResult | null>(null);
  const classify = useAction(saveClassification, { latency: 30, silent: true });
  const buying = useAction(saveBuying, { latency: 30, silent: true });
  const all = useAction(saveAllDetails, { latency: 30, silent: true });
  const [error, setError] = useState<string | null>(null);

  const showClass = mode === "classification" || mode === "all";
  const showBuy = mode === "buying" || mode === "all";
  const upper = (key: keyof FormState) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [key]: e.target.value.toUpperCase() }));
  const fieldError = useMemo(() => {
    const m: Partial<Record<CaptureField, string>> = {};
    for (const r of result?.fields ?? []) if (!r.ok && r.message) m[r.field] = r.message;
    return m;
  }, [result]);
  const buyerGrades = db.buyers.find((b) => b.code === f.buyer.trim().toUpperCase())?.grades ?? [];
  const pending = classify.isPending || buying.isPending || all.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const base = { barcode: view.barcode };
    const cls = { timbGrade: f.timbGrade, hessianOwner: f.hessianOwner };
    const buy = { buyer: f.buyer, buyerGrade: f.buyerGrade, price: f.price, saleCode: f.saleCode };
    const res = mode === "classification" ? await classify.run({ ...base, ...cls }) : mode === "buying" ? await buying.run({ ...base, ...buy }) : await all.run({ ...base, ...cls, ...buy });
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setResult(res.data);
    if (!res.data.rejectedAny) onSaved(res.data.view);
  };

  const info: Array<[string, string]> = [
    ["Sale Date", view.saleDate],
    ["No. of Bales", String(view.balesInSale)],
    ["Barcode", view.barcode],
    ["Grower", view.growerNo],
    ["Mass", String(view.mass)],
    ["SEQ", String(view.seq)],
    ["Group", String(view.group)],
    ["Lot", view.lot],
  ];

  return (
    <Card data-testid="capture-form">
      <CardContent className="p-6">
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          noValidate
          className="flex flex-col gap-6"
        >
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-surface-secondary p-4 sm:grid-cols-4" data-testid="bale-info">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className={k === "Barcode" ? "font-mono text-sm font-semibold" : "text-lg font-semibold"}>{v}</dd>
              </div>
            ))}
          </dl>

          {error ? (
            <Callout tone="danger" title="Not saved">
              {error}
            </Callout>
          ) : null}
          {result?.rejectedAny ? (
            <Callout tone={result.savedAny ? "warning" : "danger"} title={result.savedAny ? "Partly saved" : "Nothing saved"}>
              {result.savedAny ? (
                <>
                  Saved: {result.fields.filter((x) => x.ok).map((x) => FIELD_LABEL[x.field]).join(", ")}. Not saved — fix and save again:{" "}
                  {result.fields.filter((x) => !x.ok).map((x) => FIELD_LABEL[x.field]).join(", ")}.
                </>
              ) : (
                "Each field is checked separately; correct the highlighted fields."
              )}
            </Callout>
          ) : null}

          {showClass ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="TIMB Grade / Reason" htmlFor="f-timb" error={fieldError.timbGrade} hint="e.g. A10. A reason code is for bales that were not bought.">
                <Input id="f-timb" size="xl" autoFocus list="timb-grades" autoComplete="off" value={f.timbGrade} onChange={upper("timbGrade")} aria-invalid={!!fieldError.timbGrade} data-testid="f-timb" />
                <datalist id="timb-grades">
                  {db.grades.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.description ?? (g.isReason ? "Reason" : "Grade")}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field
                label={
                  <span className="flex items-center gap-2">
                    Hessian <DemoBadge>DEMO options</DemoBadge> <UnverifiedBadge uq="UQ-08" />
                  </span>
                }
                htmlFor="f-hessian"
                error={fieldError.hessianOwner}
              >
                <NativeSelect id="f-hessian" size="lg" value={f.hessianOwner} onChange={(e) => setF((s) => ({ ...s, hessianOwner: e.target.value }))} data-testid="f-hessian">
                  <option value="">-- Select Hessian Owner --</option>
                  {HESSIAN_OWNERS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          ) : null}

          {showBuy ? (
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Buyer" htmlFor="f-buyer" error={fieldError.buyer}>
                <Input id="f-buyer" size="xl" list="buyers" autoComplete="off" autoFocus={!showClass} value={f.buyer} onChange={upper("buyer")} aria-invalid={!!fieldError.buyer} data-testid="f-buyer" />
                <datalist id="buyers">
                  {db.buyers.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Buyer Grade" htmlFor="f-bgrade" error={fieldError.buyerGrade} hint={buyerGrades.length ? `Grades for ${f.buyer.toUpperCase()}: ${buyerGrades.join(", ")}` : "Enter the buyer first"}>
                <Input id="f-bgrade" size="xl" list="buyer-grades" autoComplete="off" value={f.buyerGrade} onChange={upper("buyerGrade")} aria-invalid={!!fieldError.buyerGrade} data-testid="f-bgrade" />
                <datalist id="buyer-grades">
                  {buyerGrades.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
              <Field label="Price (US cents per kg)" htmlFor="f-price" error={fieldError.price} hint="Whole number, e.g. 212">
                <Input id="f-price" size="xl" inputMode="numeric" autoComplete="off" value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} aria-invalid={!!fieldError.price} data-testid="f-price" />
              </Field>
              <Field label="Sale Code" htmlFor="f-scode" error={fieldError.saleCode} hint="Only for a bale that wasn't bought (e.g. RO, RH, CO) — it also needs a TIMB reason.">
                <Input id="f-scode" size="xl" autoComplete="off" value={f.saleCode} onChange={upper("saleCode")} aria-invalid={!!fieldError.saleCode} data-testid="f-scode" />
              </Field>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <PermissionButton permission={MODE[mode].permission} type="submit" size="xl" loading={pending} data-testid="save-details" disabled={mode === "all" && !can("data-capture.capture-buyer")}>
              Save Details
            </PermissionButton>
            <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
              Cancel — scan another
            </Button>
            <p className="text-xs text-muted-foreground">Codes are converted to capitals automatically. Esc cancels.</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function LastBaleDetails({ view }: { view: BaleCaptureView | null }) {
  const rows: Array<[string, string]> = view
    ? [
        ["Barcode", view.barcode],
        ["Grower", view.growerNo],
        ["Mass", String(view.mass)],
        ["TIMB Grade", view.timbGrade ?? "—"],
        ["Buyer", view.buyerCode ?? "—"],
        ["Buyer Grade", view.buyerGrade ?? "—"],
        ["Price", view.priceCents !== undefined ? String(view.priceCents) : "—"],
        ["Sale Code", view.saleCode ?? "—"],
        ["Hessian", view.hessianOwner ?? "N/A"],
      ]
    : [];
  return (
    <Card data-testid="last-bale-details">
      <CardHeader>
        <CardTitle>Last Bale Details</CardTitle>
        {view ? <CheckCircle2 className="size-4 text-success-text" aria-label="saved" /> : null}
      </CardHeader>
      <CardContent>
        {view ? (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className={k === "Barcode" ? "font-mono text-[13px] font-semibold" : "font-medium"}>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Check it before scanning the next bale.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Details of the bale you just saved appear here.</p>
        )}
      </CardContent>
    </Card>
  );
}

