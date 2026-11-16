import { Global, Module } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { MailService } from "../mail/mail.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { PrincipalService } from "./principal.service";
import { TokenService } from "./token.service";

/** Global so every feature module can inject AuthService (activation emails), AuditService and MailService. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, PrincipalService, TokenService, AuditService, MailService],
  exports: [AuthService, PasswordService, PrincipalService, TokenService, AuditService, MailService],
})
export class AuthModule {}
