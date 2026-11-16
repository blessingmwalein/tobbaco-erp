import { Global, Module } from "@nestjs/common";
import { ENV, getEnv } from "../config/env";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => getEnv() }, PrismaService],
  exports: [ENV, PrismaService],
})
export class DatabaseModule {}
