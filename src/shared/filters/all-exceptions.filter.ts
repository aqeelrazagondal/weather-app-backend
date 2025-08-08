import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ValidationError as ClassValidatorError } from 'class-validator';
import { AxiosError } from 'axios';
import { Logger } from '@nestjs/common';
import { ApiException } from '../exceptions/api.exception';
import type { ErrorResponse } from '../types/error.types';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const path = httpAdapter.getRequestUrl(request);

    let errorResponse: ErrorResponse;

    if (exception instanceof ApiException) {
      errorResponse = this.handleApiException(exception, path);
    } else if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception, path);
    } else if (exception instanceof AxiosError) {
      errorResponse = this.handleAxiosError(exception, path);
    } else {
      errorResponse = this.handleUnknownError(exception, path);
    }

    this.logger.error(`Error at ${path}:`, {
      ...errorResponse,
      stack: (exception as Error)?.stack,
    });

    httpAdapter.reply(
      ctx.getResponse(),
      errorResponse,
      errorResponse.statusCode,
    );
  }

  private handleApiException(
    exception: ApiException,
    path: string,
  ): ErrorResponse {
    return {
      statusCode: exception.statusCode,
      message: exception.message,
      code: exception.code,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleHttpException(
    exception: HttpException,
    path: string,
  ): ErrorResponse {
    const response = exception.getResponse() as Record<string, any>;

    if (this.isValidationError(response)) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
        path,
        details: this.formatValidationErrors(response.message),
      };
    }

    return {
      statusCode: exception.getStatus(),
      message: response.message || exception.message,
      code: response.code,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleAxiosError(error: AxiosError, path: string): ErrorResponse {
    const status = error.response?.status || HttpStatus.BAD_GATEWAY;
    const message = this.getAxiosErrorMessage(error);

    return {
      statusCode: status,
      message,
      code: 'EXTERNAL_API_ERROR',
      timestamp: new Date().toISOString(),
      path,
      details: {
        url: error.config?.url,
        method: error.config?.method,
      },
    };
  }

  private handleUnknownError(error: unknown, path: string): ErrorResponse {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      path,
      details: error instanceof Error ? error.message : undefined,
    };
  }

  private isValidationError(response: Record<string, any>): boolean {
    return (
      Array.isArray(response.message) &&
      response.message.every(
        (item: any) =>
          item.property &&
          item.constraints &&
          typeof item.constraints === 'object',
      )
    );
  }

  private formatValidationErrors(
    errors: ClassValidatorError[],
  ): Record<string, string[]> {
    return errors.reduce(
      (acc, error) => {
        const property = error.property;
        const constraints = error.constraints
          ? Object.values(error.constraints)
          : [];

        acc[property] = constraints;

        // Handle nested validation errors
        if (error.children?.length) {
          const nestedErrors = this.formatValidationErrors(error.children);
          Object.entries(nestedErrors).forEach(([key, value]) => {
            acc[`${property}.${key}`] = value;
          });
        }

        return acc;
      },
      {} as Record<string, string[]>,
    );
  }

  private getAxiosErrorMessage(error: AxiosError): string {
    if (error.response?.data && typeof error.response.data === 'object') {
      return (error.response.data as any).message || error.message;
    }
    return error.message;
  }
}
