import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'string') {
        message = errorResponse;
      } else if (errorResponse && typeof errorResponse === 'object') {
        const responseObject = errorResponse as { message?: string | string[] };

        if (Array.isArray(responseObject.message)) {
          message = responseObject.message.join(', ');
        } else if (responseObject.message) {
          message = responseObject.message;
        }
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        message = 'Duplicate record';
      } else if (exception.code === 'P2025') {
        message = 'Record not found';
      }
    }

    if (status >= 500) {
      this.logger.error('Unhandled error', exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
    });
  }
}
