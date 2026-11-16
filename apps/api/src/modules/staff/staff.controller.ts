import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { StaffOnly } from "../../common/decorators";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { ENV, type Env } from "../../config/env";
import { AppError } from "../../common/app-error";
import { PrismaService } from "../../database/prisma.service";

const mailboxQuery = z.object({
  to: z.string().trim().toLowerCase().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** ERP-staff-only utilities. */
@ApiTags("staff")
@ApiBearerAuth()
@StaffOnly()
@Controller("staff")
export class StaffController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Development mailbox: the activation / password-reset emails that were "sent" (stored, not delivered) while
   * MAIL_DRIVER=outbox. Disabled outside DEMO_MODE so production never exposes message bodies.
   */
  @Get("dev-mailbox")
  async devMailbox(@Query(new ZodValidationPipe(mailboxQuery)) q: z.infer<typeof mailboxQuery>) {
    if (!this.env.DEMO_MODE) throw AppError.notFound("Dev mailbox");
    const items = await this.prisma.outboxEmail.findMany({
      where: q.to ? { toEmail: q.to } : undefined,
      orderBy: { createdAt: "desc" },
      take: q.limit,
    });
    return { items };
  }
}
