import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { DispatchDto, DispatchPage, ProcessingCompanyDto, ProcessingCompanyPage } from "@tobacco/shared";
import type { CreateDispatchInput, CreateProcessingCompanyInput, DispatchQuery, PageQuery, UpdateProcessingCompanyInput } from "@tobacco/validation";
import { AppError } from "../../common/app-error";
import { formatReference, nextSequence } from "../../common/reference";
import type { RequestMeta } from "../../common/decorators";
import { orderBy, pageArgs, toPage } from "../../common/pagination";
import type { BuyerPrincipal } from "../../common/principal";
import { PrismaService } from "../../database/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService, makeLedgerCtx } from "../ledger/ledger.service";
import { DocumentsService } from "../../storage/documents.service";

const companyDto = (v: any): ProcessingCompanyDto => ({ id: v.id, name: v.name, registrationNo: v.registrationNo, address: v.address, contactPerson: v.contactPerson, phone: v.phone, email: v.email, active: v.active, createdAt: v.createdAt.toISOString() });
const dispatchDto = (v: any): DispatchDto => ({
  id: v.id, reference: v.reference, processingCompany: { id: v.company.id, name: v.company.name }, dispatchDate: v.dispatchDate.toISOString(),
  reason: v.reason, notes: v.notes, status: v.status, totalBales: v.totalBales, totalMassKg: v.totalMassKg.toString(), createdAt: v.createdAt.toISOString(),
  ...(v.bales ? { bales: v.bales.map((b: any) => ({ id: b.id, baleId: b.baleId, barcode: b.bale.barcode, massKgAtDispatch: b.massKgAtDispatch.toString(), status: b.status, sourceWarehouseId: b.sourceWarehouseId, sourceBayId: b.sourceBayId, sourceRowId: b.sourceRowId })) } : {}),
});

@Injectable()
export class ProcessingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AuditService) private readonly audit: AuditService, @Inject(LedgerService) private readonly ledger: LedgerService, @Inject(DocumentsService) private readonly documents: DocumentsService) {}

  async listCompanies(orgId: string, q: PageQuery): Promise<ProcessingCompanyPage> {
    const db = this.prisma.forOrganisation(orgId);
    const where: Prisma.ProcessingCompanyWhereInput = q.search ? { name: { contains: q.search, mode: "insensitive" } } : {};
    const [rows, total] = await Promise.all([db.processingCompany.findMany({ where, orderBy: orderBy(q, ["name", "createdAt"] as const, "name"), ...pageArgs(q) }), db.processingCompany.count({ where })]);
    return toPage(rows.map(companyDto), total, q);
  }
  async getCompany(orgId: string, id: string) {
    const row = await this.prisma.forOrganisation(orgId).processingCompany.findUnique({ where: { id } });
    if (!row) throw AppError.notFound("Processing company");
    return companyDto(row);
  }
  async createCompany(actor: BuyerPrincipal, input: CreateProcessingCompanyInput, meta: RequestMeta) {
    const row = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const created = await tx.processingCompany.create({ data: { ...input, buyerOrganisationId: actor.organisationId } });
      await this.audit.record(tx, actor, { action: "processing.company.created", entityType: "ProcessingCompany", entityId: created.id, entityRef: created.name, next: input }, meta);
      return created;
    });
    return companyDto(row);
  }
  async updateCompany(actor: BuyerPrincipal, id: string, input: UpdateProcessingCompanyInput, meta: RequestMeta) {
    const row = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const before = await tx.processingCompany.findUnique({ where: { id } });
      if (!before) throw AppError.notFound("Processing company");
      const updated = await tx.processingCompany.update({ where: { id }, data: input });
      await this.audit.record(tx, actor, { action: "processing.company.updated", entityType: "ProcessingCompany", entityId: id, entityRef: before.name, previous: before, next: updated }, meta);
      return updated;
    });
    return companyDto(row);
  }
  async setCompanyStatus(actor: BuyerPrincipal, id: string, active: boolean, meta: RequestMeta) {
    const row = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const before = await tx.processingCompany.findUnique({ where: { id } });
      if (!before) throw AppError.notFound("Processing company");
      const updated = await tx.processingCompany.update({ where: { id }, data: { active } });
      await this.audit.record(tx, actor, { action: `processing.company.${active ? "activated" : "deactivated"}`, entityType: "ProcessingCompany", entityId: id, entityRef: before.name, previous: { active: before.active }, next: { active }, organisationId: actor.organisationId }, meta);
      return updated;
    });
    return companyDto(row);
  }

  async listDispatches(orgId: string, q: DispatchQuery): Promise<DispatchPage> {
    const db = this.prisma.forOrganisation(orgId);
    const where: Prisma.DispatchWhereInput = q.search ? { OR: [{ reference: { contains: q.search, mode: "insensitive" } }, { company: { name: { contains: q.search, mode: "insensitive" } } }] } : {};
    const [rows, total] = await Promise.all([
      db.dispatch.findMany({ where, include: { company: true }, orderBy: orderBy(q, ["dispatchDate", "createdAt", "reference"] as const, "createdAt"), ...pageArgs(q) }),
      db.dispatch.count({ where }),
    ]);
    return toPage(rows.map(dispatchDto), total, q);
  }
  async getDispatch(orgId: string, id: string) {
    const row = await this.prisma.forOrganisation(orgId).dispatch.findUnique({ where: { id }, include: { company: true, bales: { include: { bale: true }, orderBy: { id: "asc" } } } });
    if (!row) throw AppError.notFound("Dispatch");
    return dispatchDto(row);
  }
  async attachDispatchDocument(actor: BuyerPrincipal, id: string, file: { originalname: string; mimetype: string; buffer: Buffer }, meta: RequestMeta) {
    const dispatch = await this.prisma.forOrganisation(actor.organisationId).dispatch.findUnique({ where: { id } });
    if (!dispatch) throw AppError.notFound("Dispatch");
    const document = await this.documents.store({ organisationId: actor.organisationId, kind: "DISPATCH_DOCUMENT", filename: file.originalname, mimeType: file.mimetype, data: file.buffer, principal: actor });
    await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      await tx.dispatch.update({ where: { id }, data: { documentId: document.id } });
      await this.audit.record(tx, actor, { action: "processing.dispatch.document_attached", entityType: "Dispatch", entityId: id, entityRef: dispatch.reference, next: { documentId: document.id }, organisationId: actor.organisationId }, meta);
    });
    return { documentId: document.id };
  }
  async createDispatch(actor: BuyerPrincipal, input: CreateDispatchInput, meta: RequestMeta) {
    if (new Set(input.baleIds).size !== input.baleIds.length) throw AppError.unprocessable("DUPLICATE_BALE", "A bale cannot be selected twice");
    const row = await this.prisma.tenantTransaction(actor.organisationId, async (tx) => {
      const company = await tx.processingCompany.findUnique({ where: { id: input.processingCompanyId } });
      if (!company) throw AppError.notFound("Processing company");
      if (!company.active) throw AppError.conflict("PROCESSING_COMPANY_INACTIVE", "That processing company is inactive");
      if (input.documentId) {
        const document = await tx.document.findUnique({ where: { id: input.documentId } });
        if (!document || document.buyerOrganisationId !== actor.organisationId) throw AppError.notFound("Dispatch document");
        if (document.kind !== "DISPATCH_DOCUMENT") throw AppError.unprocessable("WRONG_DOCUMENT_KIND", "Attach a dispatch document");
      }
      const bales = await tx.bale.findMany({ where: { id: { in: input.baleIds } } });
      if (bales.length !== input.baleIds.length) throw AppError.notFound("Bale");
      const n = await nextSequence(tx, actor.organisationId, `DSP-${new Date(input.dispatchDate).getUTCFullYear()}`);
      const org = await tx.buyerOrganisation.findUniqueOrThrow({ where: { id: actor.organisationId } });
      const reference = formatReference("DSP", org.code, new Date(input.dispatchDate).getUTCFullYear(), n);
      const dispatch = await tx.dispatch.create({ data: { buyerOrganisationId: actor.organisationId, reference, processingCompanyId: company.id, dispatchDate: new Date(input.dispatchDate), reason: input.reason, notes: input.notes ?? null, documentId: input.documentId ?? null, totalBales: bales.length, totalMassKg: bales.reduce((s, b) => s + Number(b.massKg), 0), createdById: actor.id } });
      const ctx = makeLedgerCtx(tx, actor);
      const lines = [];
      for (const bale of bales) {
        const source = await this.ledger.dispatchOut(ctx, bale, { dispatch: { type: "DISPATCH", id: dispatch.id, label: reference }, companyName: company.name });
        lines.push({ buyerOrganisationId: actor.organisationId, dispatchId: dispatch.id, baleId: bale.id, sourceWarehouseId: source.warehouseId, sourceBayId: source.bayId, sourceRowId: source.rowId, massKgAtDispatch: source.massKg ?? bale.massKg });
      }
      await tx.dispatchBale.createMany({ data: lines });
      await this.audit.record(tx, actor, { action: "processing.dispatch.created", entityType: "Dispatch", entityId: dispatch.id, entityRef: reference, next: { reference, company: company.name, baleCount: bales.length }, organisationId: actor.organisationId }, meta);
      return tx.dispatch.findUniqueOrThrow({ where: { id: dispatch.id }, include: { company: true, bales: { include: { bale: true } } } });
    });
    return dispatchDto(row);
  }
}
