export interface BaleTimelineEventDto {
  id: string;
  type: string;
  occurredAt: string;
  performedByName: string | null;
  fromLabel: string | null;
  toLabel: string | null;
  refType: string | null;
  refId: string | null;
  refLabel: string | null;
  notes: string | null;
  payload: unknown;
}
export interface BaleTimelineDto {
  bale: Record<string, unknown>;
  events: BaleTimelineEventDto[];
  movements: Record<string, unknown>[];
  scans: Record<string, unknown>[];
  lineage: Record<string, unknown>[];
}
