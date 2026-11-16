import { Global, Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service";

/** Global: receiving, movements, dispatch and returns all use the same ledger primitives. */
@Global()
@Module({ providers: [LedgerService], exports: [LedgerService] })
export class LedgerModule {}
