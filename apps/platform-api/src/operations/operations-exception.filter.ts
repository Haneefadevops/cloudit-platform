import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Module-scoped exception filter for the operations endpoints. It runs
 * before the global AllExceptionsFilter for these routes and guarantees the
 * safe response contract: HTTP errors keep their status with a generic
 * body; anything else (including database errors) becomes a bare 500 with
 * no stack, SQL or secret material. Full details are logged server-side
 * only.
 */
@Catch()
export class OperationsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OperationsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        {
          method: request.method,
          path: request.url,
          message:
            exception instanceof Error ? exception.message : 'Unknown error',
        },
        OperationsExceptionFilter.name,
      );
    }

    const message =
      status === 401
        ? 'Unauthorized'
        : status === 404
          ? 'Not found'
          : status === 400
            ? 'Bad request'
            : 'Internal server error';

    response.status(status).json({ statusCode: status, message });
  }
}
