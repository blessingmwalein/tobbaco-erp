"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, ErrorState, PageHeader, Skeleton } from "@tobacco/ui";
import { companyProfileSchema, type CompanyProfileInput } from "@tobacco/validation";
import { buyerApi, describeError, useBuyerMutation, useBuyerQuery } from "@/lib/api";
import { RequireBuyerPermission } from "@/components/buyer/require-buyer-session";

export default function CompanyProfilePage() {
  const company = useBuyerQuery<CompanyProfileInput & { code: string; status: string }>("/buyer/company");
  const form = useForm<CompanyProfileInput>({ resolver: zodResolver(companyProfileSchema) });
  const update = useBuyerMutation((values: CompanyProfileInput) => buyerApi.patch("/buyer/company", values), { success: "Company profile saved", toastError: false });
  const onSubmit = form.handleSubmit(async (values) => { await update.mutateAsync(values); void company.refetch(); });
  const data = company.data;
  return <RequireBuyerPermission permission="buyer.company.manage"><PageHeader title="Company profile" description="Manage the details shown on buyer documents." />
    {company.isLoading ? <Skeleton className="h-96" /> : company.isError ? <ErrorState title="Could not load company profile" description={describeError(company.error)} action={<Button variant="secondary" onClick={() => void company.refetch()}>Try again</Button>} /> : data ? (
      <Card className="max-w-3xl"><CardHeader><CardTitle>{data.name}</CardTitle><CardDescription>Buyer code: {data.code} · Status: {data.status}</CardDescription></CardHeader><CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit} noValidate aria-label="Company profile">
          {update.isError ? <Callout tone="danger" className="sm:col-span-2" title="Could not save">{describeError(update.error)}</Callout> : null}
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Company name</span><input className="h-10 w-full rounded-lg border border-border bg-background px-3" defaultValue={data.name} {...form.register("name")} />{form.formState.errors.name && <span className="text-xs text-danger-text">{form.formState.errors.name.message}</span>}</label>
          <label className="text-sm"><span className="mb-1 block font-medium">Registration number</span><input className="h-10 w-full rounded-lg border border-border bg-background px-3" defaultValue={data.registrationNo ?? ""} {...form.register("registrationNo")} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Contact person</span><input className="h-10 w-full rounded-lg border border-border bg-background px-3" defaultValue={data.contactPerson ?? ""} {...form.register("contactPerson")} /></label>
          <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Address</span><textarea className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2" defaultValue={data.address ?? ""} {...form.register("address")} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Phone</span><input className="h-10 w-full rounded-lg border border-border bg-background px-3" defaultValue={data.phone ?? ""} {...form.register("phone")} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Email</span><input className="h-10 w-full rounded-lg border border-border bg-background px-3" type="email" defaultValue={data.email ?? ""} {...form.register("email")} /></label>
          <Button type="submit" className="sm:col-span-2 sm:w-fit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button>
        </form>
      </CardContent></Card>
    ) : null}</RequireBuyerPermission>;
}
