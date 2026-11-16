import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { ConfirmProcessingReturnInput, CreateProcessingReturnInput, ReturnBaleInput } from "@tobacco/validation";
import type { ProcessingReturnDto } from "@tobacco/shared";
import { AppError } from "../../common/app-error";
import { formatReference, nextSequence } from "../../common/reference";
import type { RequestMeta } from "../../common/decorators";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService, makeLedgerCtx } from "../ledger/ledger.service";

const dto = (v: any): ProcessingReturnDto => ({ id: v.id, reference: v.reference, dispatchId: v.dispatchId, status: v.status, startedAt: v.startedAt.toISOString(), confirmedAt: v.confirmedAt?.toISOString() ?? null, reconciliation: v.reconciliation ?? null, ...(v.bales ? { bales: v.bales.map((b: any) => ({ id: b.id, scannedBarcode: b.scannedBarcode, outcome: b.outcome, returnedMassKg: b.returnedMassKg?.toString() ?? null, explanation: b.explanation, newBaleId: b.newBaleId })) } : {}) });

@Injectable()
export class ReturnsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService, @Inject(LedgerService) private readonly ledger: LedgerService) {}

  async start(actor: BuyerPrincipal, input: CreateProcessingReturnInput, meta: RequestMeta) {
    const ret = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const dispatch = await tx.dispatch.findUnique({ where: { id: input.dispatchId } });
      if (!dispatch) throw AppError.notFound("Dispatch");
      if (dispatch.status === "CLOSED") throw AppError.conflict("DISPATCH_CLOSED", "This dispatch is closed");
      const n = await nextSequence(tx, actor.organisationId, `RET-${new Date().getUTCFullYear()}`);
      const org = await tx.buyerOrganisation.findUniqueOrThrow({ where: { id: actor.organisationId } });
      const created = await tx.processingReturn.create({ data: { buyerOrganisationId: actor.organisationId, dispatchId: dispatch.id, reference: formatReference("RET", org.code, new Date().getUTCFullYear(), n), startedById: actor.id, notes: input.notes ?? null } });
      await this.audit.record(tx, actor, { action: "processing.return.started", entityType: "ProcessingReturn", entityId: created.id, entityRef: created.reference, next: { dispatchId: dispatch.id }, organisationId: actor.organisationId }, meta);
      return created;
    });
    return dto(ret);
  }

  async get(orgId: string, id: string) {
    const ret = await this.prisma.forOrganisation(orgId).processingReturn.findUnique({ where: { id }, include: { bales: true } });
    if (!ret) throw AppError.notFound("Processing return");
    return dto(ret);
  }

  async confirm(actor: BuyerPrincipal, id: string, input: ConfirmProcessingReturnInput, meta: RequestMeta) {
    const ret = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const current = await tx.processingReturn.findUnique({ where: { id } });
      if (!current) throw AppError.notFound("Processing return");
      if (current.status !== "OPEN") throw AppError.conflict("RETURN_NOT_OPEN", "This return has already been confirmed or cancelled");
      const dispatch = await tx.dispatch.findUnique({ where: { id: current.dispatchId }, include: { company: true, bales: { include: { bale: true } } } });
      if (!dispatch) throw AppError.notFound("Dispatch");
      const outstanding = new Map(dispatch.bales.filter((b) => b.status === "OUTSTANDING").map((b) => [b.id, b]));
      const seen = new Set<string>();
      const rows: Prisma.ReturnBaleCreateManyInput[] = [];
      const ctx = makeLedgerCtx(tx, actor);
      let returnedMass = 0;
      let unexpected = 0;
      for (const item of input.bales) {
        if (item.dispatchBaleId && seen.has(item.dispatchBaleId)) throw AppError.conflict("DUPLICATE_RETURN", "A dispatched bale was returned twice");
        if (item.dispatchBaleId) seen.add(item.dispatchBaleId);
        const line = item.dispatchBaleId ? outstanding.get(item.dispatchBaleId) : undefined;
        if (item.outcome !== "UNEXPECTED" && !line) throw AppError.unprocessable("RETURN_NOT_EXPECTED", "That bale is not outstanding on this dispatch");
        const discrepancy = item.outcome !== "RETURNED" || (line && item.returnedMassKg != null && Number(item.returnedMassKg) !== Number(line.massKgAtDispatch));
        if (discrepancy && !item.explanation) throw AppError.unprocessable("EXPLANATION_REQUIRED", "Explain every damaged, missing, regraded or mass-different return");
        let newBaleId: string | null = null;
        let location: any = null;
        if (item.outcome !== "MISSING" && item.outcome !== "UNEXPECTED") {
          if (!item.warehouseId) throw AppError.unprocessable("LOCATION_REQUIRED", "Choose a processing warehouse for returned tobacco");
          location = await this.ledger.resolveLocation(tx, { warehouseId: item.warehouseId, bayId: item.bayId, rowId: item.rowId }, { kind: "PROCESSING" });
        }
        if (line && item.outcome !== "MISSING" && item.outcome !== "UNEXPECTED") {
          if (item.outcome === "REIDENTIFIED") {
            if (!item.newBarcode) throw AppError.unprocessable("BARCODE_REQUIRED", "A new barcode is required for a re-identified bale");
            const created = await this.ledger.reidentify(ctx, line.bale, { newBarcode: item.newBarcode, newMassKg: item.returnedMassKg ?? line.massKgAtDispatch, newBuyerGrade: item.newBuyerGrade, newTimbGrade: item.newTimbGrade, ret: { type: "RETURN", id: current.id, label: current.reference }, reason: item.explanation!, location });
            newBaleId = created.id;
          } else {
            await this.ledger.returnIn(ctx, line.bale, { ret: { type: "RETURN", id: current.id, label: current.reference }, location, notes: item.explanation, massKg: item.returnedMassKg });
            if (item.newBuyerGrade || item.newTimbGrade) await tx.bale.update({ where: { id: line.baleId }, data: { buyerGrade: item.newBuyerGrade ?? undefined, timbGrade: item.newTimbGrade ?? undefined } });
            newBaleId = line.baleId;
          }
          await tx.dispatchBale.update({ where: { id: line.id }, data: { status: item.outcome === "REIDENTIFIED" ? "REPLACED" : "RETURNED" } });
          returnedMass += Number(item.returnedMassKg ?? line.massKgAtDispatch);
        } else if (line && item.outcome === "MISSING") {
          await tx.dispatchBale.update({ where: { id: line.id }, data: { status: "MISSING" } });
        } else if (item.outcome === "UNEXPECTED") unexpected++;
        rows.push({ buyerOrganisationId: actor.organisationId, returnId: current.id, dispatchBaleId: line?.id ?? null, originalBaleId: line?.baleId ?? null, scannedBarcode: item.scannedBarcode, outcome: item.outcome, returnedMassKg: item.returnedMassKg ?? null, newBuyerGrade: item.newBuyerGrade ?? null, newTimbGrade: item.newTimbGrade ?? null, condition: item.condition ?? null, explanation: item.explanation ?? null, warehouseId: location?.warehouseId ?? null, bayId: location?.bayId ?? null, rowId: location?.rowId ?? null, newBaleId, scannedById: actor.id });
      }
      await tx.returnBale.createMany({ data: rows });
      const outstandingCount = await tx.dispatchBale.count({ where: { dispatchId: dispatch.id, status: "OUTSTANDING" } });
      const missingCount = await tx.dispatchBale.count({ where: { dispatchId: dispatch.id, status: "MISSING" } });
      const originalMass = dispatch.totalMassKg.toString();
      const reconciliation = { originalBales: dispatch.totalBales, returnedBales: rows.filter((r) => r.outcome !== "MISSING" && r.outcome !== "UNEXPECTED").length, outstandingBales: outstandingCount, missingBales: missingCount, unexpectedBales: unexpected, originalMassKg: originalMass, returnedMassKg: returnedMass.toFixed(1), massVarianceKg: (returnedMass - Number(originalMass)).toFixed(1) };
      if ((outstandingCount > 0 || unexpected > 0 || Number(reconciliation.massVarianceKg) !== 0) && !input.explanation) throw AppError.unprocessable("EXPLANATION_REQUIRED", "Explain the return reconciliation discrepancy");
      const status = outstandingCount === 0 && missingCount === 0 ? "RETURNED" : "PARTIALLY_RETURNED";
      await tx.dispatch.update({ where: { id: dispatch.id }, data: { status } });
      const updated = await tx.processingReturn.update({ where: { id }, data: { status: "CONFIRMED", confirmedById: actor.id, confirmedAt: new Date(), reconciliation } , include: { bales: true } });
      await this.audit.record(tx, actor, { action: "processing.return.confirmed", entityType: "ProcessingReturn", entityId: id, entityRef: current.reference, next: reconciliation, reason: input.explanation ?? null, organisationId: actor.organisationId }, meta);
      return updated;
    });
    return dto(ret);
  }
}
