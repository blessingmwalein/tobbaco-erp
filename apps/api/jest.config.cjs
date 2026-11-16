/** Unit tests: pure logic (parsers, validators, reconciliation math, guards) — no database needed. */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: { module: "commonjs", moduleResolution: "node", target: "ES2022", esModuleInterop: true, experimentalDecorators: true, skipLibCheck: true },
      },
    ],
  },
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
  // Workspace packages are TypeScript sources outside node_modules (via symlinks) — they must be transformed too.
  transformIgnorePatterns: ["/node_modules/(?!(@tobacco)/)"],
  testTimeout: 20000,
};
