#!/usr/bin/env node
/**
 * Production bundle: one CommonJS file (dist/main.js) with the workspace packages inlined.
 * Works because providers use explicit @Inject(...) (no emitted decorator metadata needed).
 * Native / generated / optional-peer packages stay external.
 */
import { build } from "esbuild";

const external = [
  "@prisma/client",
  ".prisma/client",
  "@node-rs/argon2",
  "pdfjs-dist",
  "exceljs",
  "pdf-lib",
  // Nest's optional peers (loaded lazily with try/require)
  "@nestjs/microservices",
  "@nestjs/websockets",
  "@nestjs/platform-fastify",
  "class-validator",
  "class-transformer",
  "cache-manager",
  "@fastify/static",
  "@fastify/view",
];

await build({
  entryPoints: ["src/main.ts", "src/vercel.ts"],
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: true,
  external,
  tsconfig: "tsconfig.json",
  logLevel: "info",
  // reflect-metadata must load first; main.ts imports it at the top.
});
console.log("API bundle written to dist/");
