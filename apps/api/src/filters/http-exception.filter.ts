import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorLogger = {
  error?: (object: unknown, message?: string) => void;
};

type HttpExceptionObjectResponse = {
  message?: unknown;
  errorCode?: unknown;
};

const FALLBACK_ERROR_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

function isErrorCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9_]+$/.test(value);
}

function messageFromUnknown(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    const joined = value
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .join('; ')
      .trim();
    return joined.length > 0 ? joined : null;
  }

  return null;
}

function toErrorCodeFromMessage(message: string): string {
  const normalized = message
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

  return normalized.length > 0 ? normalized : 'INTERNAL_SERVER_ERROR';
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: ErrorLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = 'Internal server error';
    let messageSource: unknown = null;
    let explicitErrorCode: string | null = null;

    if (exception instanceof HttpException) {
      const rawResponse = exception.getResponse();
      if (typeof rawResponse === 'string') {
        message = rawResponse;
        messageSource = rawResponse;
      } else if (rawResponse && typeof rawResponse === 'object') {
        const objectResponse = rawResponse as HttpExceptionObjectResponse;
        const parsedMessage = messageFromUnknown(objectResponse.message);
        if (parsedMessage) {
          message = parsedMessage;
          messageSource = objectResponse.message;
        }

        if (isErrorCode(objectResponse.errorCode)) {
          explicitErrorCode = objectResponse.errorCode;
        }
      }
    } else {
      this.logger?.error?.({ exception }, 'Unhandled exception');
    }

    const isValidationMessageArray =
      status === HttpStatus.BAD_REQUEST && Array.isArray(messageSource);
    const errorCode =
      explicitErrorCode ??
      (isValidationMessageArray
        ? 'VALIDATION_ERROR'
        : /^[A-Z0-9_]+$/.test(message)
          ? message
          : status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'INTERNAL_SERVER_ERROR'
            : toErrorCodeFromMessage(message));

    const stableErrorCode =
      errorCode.length > 0
        ? errorCode
        : (FALLBACK_ERROR_CODE_BY_STATUS[status] ?? 'INTERNAL_SERVER_ERROR');

    response.status(status).json({
      statusCode: status,
      errorCode: stableErrorCode,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
