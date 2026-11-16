import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ENV, type Env } from "../../config/env";
import { PrismaService } from "../../database/prisma.service";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** e.g. "password-reset", "account-activation" — shown in the dev mailbox. */
  kind: string;
}

/**
 * Mail delivery behind an interface.
 *  - `outbox` (default, development): the message is stored in the `outbox_emails` table and logged — NO real email is sent.
 *    ERP staff can read it at GET /staff/dev-mailbox. This is how activation / reset links are reached in development.
 *  - `smtp`: NOT implemented yet — selecting it fails loudly instead of pretending to send.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async send(mail: OutgoingMail): Promise<void> {
    if (this.env.MAIL_DRIVER === "smtp") {
      throw new ServiceUnavailableException("The SMTP mail driver is not implemented yet. Use MAIL_DRIVER=outbox for development.");
    }
    await this.prisma.outboxEmail.create({
      data: { toEmail: mail.to, subject: mail.subject, bodyText: mail.text, kind: mail.kind, driver: "outbox" },
    });
    this.logger.log(JSON.stringify({ driver: "outbox", to: mail.to, subject: mail.subject, kind: mail.kind }));
  }
}
