import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtre global d'erreurs : empêche toute fuite de stack trace, requête SQL ou détail Prisma interne.
 */
@Catch()
export class SanitizedExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const rawResponse = exception.getResponse();

      let message: string | string[] = 'Requête rejetée.';
      let error = exception.name;

      if (typeof rawResponse === 'string') {
        message = rawResponse;
      } else if (rawResponse && typeof rawResponse === 'object') {
        const obj = rawResponse as Record<string, any>;
        message = obj.message || message;
        error = obj.error || error;
      }

      // Ne jamais exposer de messages techniques Prisma / SQL dans un 500 HTTP exception
      if (status >= 500) {
        message = 'Une erreur interne est survenue.';
        error = 'Internal Server Error';
      }

      response.status(status).json({
        statusCode: status,
        error,
        message,
        path: request?.url?.split('?')[0] || '',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Erreur inattendue (Prisma, runtime, etc.) -> réponse générique sans détails internes
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Une erreur interne est survenue.',
      path: request?.url?.split('?')[0] || '',
      timestamp: new Date().toISOString(),
    });
  }
}
