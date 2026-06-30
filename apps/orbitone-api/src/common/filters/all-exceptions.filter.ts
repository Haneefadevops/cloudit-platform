import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { RequestWithId } from "../middleware/request-id.middleware";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : "Internal server error";

    const stack =
      exception instanceof Error ? exception.stack : "No stack trace available";

    this.logger.error(
      {
        requestId: request.requestId,
        method: request.method,
        path: request.url,
        statusCode: status,
        message:
          exception instanceof Error ? exception.message : "Unknown error",
        stack,
      },
      AllExceptionsFilter.name,
    );

    response.status(status).json({
      ok: false,
      error: message,
    });
  }
}
