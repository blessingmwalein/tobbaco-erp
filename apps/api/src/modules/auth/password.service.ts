import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

/** OWASP-recommended minimum for Argon2id (19 MiB, 2 iterations, 1 lane). @node-rs/argon2 defaults to Argon2id. */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private dummy?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /**
   * Burn the same time as a real verification so "unknown email" and "wrong password" are indistinguishable by timing.
   */
  async dummyVerify(password: string): Promise<void> {
    this.dummy ??= hash("not-a-real-password-for-timing-only", OPTIONS);
    await this.verify(await this.dummy, password);
  }
}
