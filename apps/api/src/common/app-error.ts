import { HttpException } from "@nestjs/common";

/**
 * Domain error with a stable machine code. Every business-rule failure in the API throws one of these:
 * the client gets `{ error: { code, message, details, requestId } }` with the matching HTTP status.
 */
export class AppError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status = 400,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }

  static badRequest(code: string, message: string, details?: unknown) {
    return new AppError(code, message, 400, details);
  }
  static unauthorized(message = "Authentication required", code = "UNAUTHENTICATED") {
    return new AppError(code, message, 401);
  }
  static forbidden(message = "You do not have permission to do that", code = "FORBIDDEN", details?: unknown) {
    return new AppError(code, message, 403, details);
  }
  static notFound(what = "Resource", code = "NOT_FOUND") {
    return new AppError(code, `${what} not found`, 404);
  }
  static conflict(code: string, message: string, details?: unknown) {
    return new AppError(code, message, 409, details);
  }
  static unprocessable(code: string, message: string, details?: unknown) {
    return new AppError(code, message, 422, details);
  }
}
