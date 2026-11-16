/** Anything with Prisma's `$queryRaw` (the PrismaService or a transaction client). */
export interface RawClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

/**
 * Atomically allocate the next number in a per-organisation counter (e.g. key "DSP-2026" → 1, 2, 3 …).
 * One statement (INSERT … ON CONFLICT DO UPDATE … RETURNING) so concurrent callers never get the same number,
 * and inside a transaction a rolled-back operation does not leave a gap-free guarantee — numbers are unique, not gapless.
 */
export async function nextSequence(db: RawClient, organisationId: string, key: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO reference_sequences (id, "buyerOrganisationId", key, value)
    VALUES (gen_random_uuid(), ${organisationId}::uuid, ${key}, 1)
    ON CONFLICT ("buyerOrganisationId", key)
    DO UPDATE SET value = reference_sequences.value + 1
    RETURNING value`;
  const value = rows[0]?.value;
  if (typeof value !== "number") throw new Error(`Could not allocate a reference number for ${key}`);
  return value;
}

/** DSP-MZ-2026-0001 */
export function formatReference(prefix: string, organisationCode: string, year: number, n: number): string {
  return `${prefix}-${organisationCode}-${year}-${String(n).padStart(4, "0")}`;
}
