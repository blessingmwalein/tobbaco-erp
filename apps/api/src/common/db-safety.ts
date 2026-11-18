/**
 * Guards for the scripts and tests that TRUNCATE a database. They must never run against the development database,
 * so the target is compared with the DATABASE_URL in apps/api/.env — by identity (host, database, user), not by string.
 */

/** host (without Neon's "-pooler"), database and user: the identity of the data a connection string points at. */
export function databaseIdentity(connection: string): string {
  const u = new URL(connection);
  return `${u.hostname.replace("-pooler", "")}|${u.pathname}|${decodeURIComponent(u.username)}`;
}

export function sameDatabase(a: string, b: string): boolean {
  try {
    return databaseIdentity(a) === databaseIdentity(b);
  } catch {
    return false; // not a URL: cannot be proven the same
  }
}

/** DATABASE_URL as written in the text of a .env file, or undefined. */
export function databaseUrlFromEnvText(text: string): string | undefined {
  const line = text.split(/\r?\n/).find((l) => /^\s*DATABASE_URL\s*=/.test(l));
  const value = line?.slice(line.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "");
  return value || undefined;
}

export const DEVELOPMENT_DATABASE_MESSAGE =
  "Refusing: the target database is the same one apps/api/.env uses for development (DATABASE_URL). " +
  "This wipes every table. Pass a DIFFERENT, disposable database (a separate Neon branch or a scratch Postgres).";

/** True when `target` is the development database named in the given .env text. */
export function isDevelopmentDatabase(target: string, envText: string | undefined): boolean {
  const dev = envText ? databaseUrlFromEnvText(envText) : undefined;
  return Boolean(dev && sameDatabase(dev, target));
}
