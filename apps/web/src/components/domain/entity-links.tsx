import Link from "next/link";
import { cn } from "@tobacco/ui";

/**
 * Business references stay linked and searchable everywhere (brief Part 8).
 * Route parameters are entity `id`s (e.g. /receiving/delivery-notes/gdn-0000005) except growers (grower number)
 * and pay batches (number).
 */
function RefLink({ href, children, className, mono = true }: { href: string; children: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={cn("font-medium text-primary underline-offset-2 hover:underline", mono && "font-mono text-[13px]", className)}
    >
      {children}
    </Link>
  );
}

export const GrowerLink = ({ growerNo, label }: { growerNo: string; label?: string }) => (
  <RefLink href={`/growers/${growerNo}`}>{label ?? growerNo}</RefLink>
);
export const TdnLink = ({ id, docNo }: { id: string; docNo: string }) => <RefLink href={`/receiving/transporter-notes/${id}`}>{docNo}</RefLink>;
export const GdnLink = ({ id, docNo }: { id: string; docNo: string }) => <RefLink href={`/receiving/delivery-notes/${id}`}>{docNo}</RefLink>;
export const SaleLink = ({ id, refNo }: { id: string; refNo: number }) => <RefLink href={`/sales/${id}`}>Sale #{refNo}</RefLink>;
export const BatchLink = ({ id, refNo }: { id: string; refNo: number }) => <RefLink href={`/batches/${id}`}>Batch {refNo}</RefLink>;
export const DispatchLink = ({ id, reference }: { id: string; reference: string }) => <RefLink href={`/dispatch/${id}`}>{reference}</RefLink>;
export const PayBatchLink = ({ no }: { no: number }) => <RefLink href={`/finance/payments/${no}`}>Pay batch {no}</RefLink>;
export const ImportLink = ({ id, label }: { id: string; label: string }) => <RefLink href={`/timb/imports/${id}`}>{label}</RefLink>;
