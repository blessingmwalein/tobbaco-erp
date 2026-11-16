import { PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Validates a request body / query / param against a Zod schema (shared with the web forms via @tobacco/validation).
 * A failure throws ZodError, which the global filter turns into a 422 with per-field messages.
 *   @Body(new ZodValidationPipe(schema)) body: z.infer<typeof schema>
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
