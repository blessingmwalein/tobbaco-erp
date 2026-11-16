// Vercel serverless entry. `pnpm build` (scripts/build.mjs) bundles src/vercel.ts to dist/vercel.js.
// Deploy as a separate Vercel project: Root Directory = apps/api, Build Command = `pnpm build`.
const mod = require("../dist/vercel.js");
module.exports = mod.default ?? mod;
