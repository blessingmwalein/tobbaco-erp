import "reflect-metadata";
import { ConsoleLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { requestIdMiddleware } from "./common/request-id.middleware";
import { getEnv } from "./config/env";

export const API_PREFIX = "api/v1";

/**
 * Builds the Nest application. Shared by the local server (main.ts) and the Vercel serverless entry (vercel.ts).
 */
export async function createApp(): Promise<NestExpressApplication> {
  const env = getEnv(); // fails fast with a readable message when .env is missing/invalid
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ json: true, logLevels: env.NODE_ENV === "production" ? ["log", "warn", "error"] : ["log", "warn", "error", "debug"] }),
    bufferLogs: false,
  });

  app.set("trust proxy", 1); // behind Vercel / a load balancer: real client IP for rate limiting and audit
  app.disable("x-powered-by");
  app.use(requestIdMiddleware);
  // The web app (another origin) fetches JSON and file downloads with a bearer token — no cookies — so a
  // cross-origin resource policy of "same-origin" would only get in the way of document previews.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.enableCors({
    origin: env.WEB_ORIGIN.split(",").map((o) => o.trim()),
    credentials: false, // bearer tokens in the Authorization header — no cookies
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "Idempotency-Key"],
    exposedHeaders: ["x-request-id", "Content-Disposition"],
    maxAge: 600,
  });
  app.setGlobalPrefix(API_PREFIX);

  if (env.SWAGGER_ENABLED) {
    const config = new DocumentBuilder()
      .setTitle("Tobacco ERP API")
      .setDescription("Buyer Portal (external buyers) and ERP staff endpoints. Authenticate with POST /auth/buyer/login or /auth/staff/login and send the access token as a Bearer token.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, config), { jsonDocumentUrl: "api/docs-json" });
  }
  return app;
}
