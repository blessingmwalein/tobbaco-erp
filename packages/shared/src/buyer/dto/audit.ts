export interface AuditLogDto {
  id: string;
  occurredAt: string;
  principalType: string | null;
  principalId: string | null;
  principalName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityRef: string | null;
  previous: unknown;
  next: unknown;
  reason: string | null;
}
