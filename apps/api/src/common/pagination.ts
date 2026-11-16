import type { Page } from "@tobacco/shared";
import type { PageQuery } from "@tobacco/validation";

/** Prisma `skip`/`take` for a validated page query. */
export function pageArgs(q: Pick<PageQuery, "page" | "pageSize">): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function toPage<T>(items: T[], total: number, q: Pick<PageQuery, "page" | "pageSize">): Page<T> {
  return { items, total, page: q.page, pageSize: q.pageSize };
}

/** Whitelisted sort: only fields in `allowed` can be sorted on (never trust a client-supplied column name). */
export function orderBy<T extends string>(q: Pick<PageQuery, "sort" | "dir">, allowed: readonly T[], fallback: T): Record<T, "asc" | "desc"> {
  const field = (allowed as readonly string[]).includes(q.sort ?? "") ? (q.sort as T) : fallback;
  return { [field]: q.dir } as Record<T, "asc" | "desc">;
}
