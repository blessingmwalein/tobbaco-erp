import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AllExceptionsFilter } from "./common/http-exception.filter";
import { DatabaseModule } from "./database/database.module";
import { AuthGuard } from "./modules/auth/auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthController } from "./modules/health/health.controller";
import { StorageModule } from "./storage/storage.module";
import { FEATURE_MODULES } from "./modules/feature-modules";

@Module({
  imports: [
    // Global default; sensitive endpoints (login, reset) declare tighter limits with @Throttle.
    // In test mode throttling is skipped unless a test opts in with THROTTLE_TEST=1 (so repeated logins don't flake).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === "test" && process.env.THROTTLE_TEST !== "1",
    }),
    DatabaseModule,
    StorageModule,
    AuthModule,
    ...FEATURE_MODULES,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
