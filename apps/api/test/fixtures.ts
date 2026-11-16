import type { BaleStatus, Prisma, PrismaClient } from "@prisma/client";

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Minimal invoice + purchase for an organisation (test helper). */
export async function makePurchase(prisma: PrismaClient, organisationId: string, code = "MZ") {
  const ref = uniq();
  const invoice = await prisma.buyerInvoice.create({
    data: {
      buyerOrganisationId: organisationId,
      reference: `BINV-${code}-${ref}`,
      floorName: "ETHICAL SALES FLOOR",
      buyerNameOnInvoice: `${code} TEST`,
      saleDateFrom: new Date("2026-05-22"),
      saleDateTo: new Date("2026-05-22"),
      invoiceDate: new Date("2026-05-22"),
      exchangeRate: "26.3216",
      totalBales: 1,
      totalMassKg: "100",
      avgUscPerKg: "200",
      totalUsdValue: "200",
    },
  });
  return prisma.purchase.create({
    data: {
      buyerOrganisationId: organisationId,
      invoiceId: invoice.id,
      reference: `PUR-${code}-${ref}`,
      floorName: "ETHICAL SALES FLOOR",
      saleDate: new Date("2026-05-22"),
      totalBales: 1,
      totalMassKg: "100",
      totalUsdValue: "200",
    },
  });
}

export async function makeBale(
  prisma: PrismaClient,
  organisationId: string,
  purchaseId: string,
  barcode: string,
  overrides: Partial<Prisma.BaleUncheckedCreateInput> & { status?: BaleStatus } = {},
) {
  return prisma.bale.create({
    data: {
      buyerOrganisationId: organisationId,
      purchaseId,
      barcode,
      season: 2026,
      buyerGrade: "L4OMA",
      timbGrade: "L4OK",
      growerNo: "349376",
      lotNo: "0057",
      massKg: "112",
      uscPerKg: "270",
      usdValue: "302.40",
      ...overrides,
    },
  });
}
