import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { ENV, type Env } from "../config/env";
import { tenantExtension } from "./tenant-extension";

/**
 * Prisma access. The API runs on serverless (Vercel) against Neon's POOLED connection string, so a single client is
 * created lazily and reused; `$transaction` is used for every multi-step state change.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) env: Env) {
    super({
      datasources: { db: { url: env.DATABASE_URL } },
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  /** A client that can only see and write ONE buyer organisation's rows. Use this in every buyer-facing service. */
  forOrganisation(organisationId: string) {
    return this.$extends(tenantExtension(organisationId));
  }

  /**
   * Run a multi-step state change atomically AND confined to one organisation.
   * Everything inside either commits together or rolls back together (dispatch, return, receiving, imports …).
   */
  tenantTransaction<T>(organisationId: string, fn: (tx: TenantTx) => Promise<T>, options: { timeoutMs?: number } = {}): Promise<T> {
    return this.forOrganisation(organisationId).$transaction(fn, { maxWait: 10_000, timeout: options.timeoutMs ?? 30_000 });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export type TenantClient = ReturnType<PrismaService["forOrganisation"]>;
/** The tenant-scoped transaction client handed to `tenantTransaction` callbacks. */
export type TenantTx = Parameters<Parameters<TenantClient["$transaction"]>[0]>[0];
/** The (unscoped) transaction client handed to `$transaction(async (tx) => …)` callbacks. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
