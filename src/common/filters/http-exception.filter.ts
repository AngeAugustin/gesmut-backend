import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MongoError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Une erreur est survenue';
    let details: any = null;

    // Gestion des erreurs MongoDB (directes ou via Mongoose)
    const mongoError = this.getMongoError(exception);
    if (mongoError) {
      status = HttpStatus.BAD_REQUEST;
      
      switch (mongoError.code) {
        case 11000: // Duplicate key error
          const field = this.extractDuplicateField(mongoError.message);
          message = `Cette valeur existe déjà dans le système`;
          details = {
            field: field,
            error: 'DUPLICATE_KEY',
            message: `Le ${field || 'champ'} que vous essayez d'ajouter existe déjà. Veuillez utiliser une valeur différente.`,
          };
          break;
        
        case 11001: // Duplicate key error (alternative)
          message = 'Cette valeur existe déjà dans le système';
          details = {
            error: 'DUPLICATE_KEY',
            message: 'La valeur que vous essayez d\'ajouter existe déjà.',
          };
          break;
        
        case 16755: // Invalid BSON format
          message = 'Format de données invalide';
          details = {
            error: 'INVALID_FORMAT',
            message: 'Les données envoyées ne sont pas dans un format valide.',
          };
          break;
        
        default:
          message = 'Erreur de base de données';
          details = {
            error: 'DATABASE_ERROR',
            message: mongoError.message || 'Une erreur est survenue lors de l\'accès à la base de données.',
          };
      }
    }
    // Gestion des erreurs HTTP NestJS
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        details = responseObj;
      } else {
        message = exception.message;
      }
    }
    // Gestion des autres erreurs
    else if (exception instanceof Error) {
      message = exception.message || 'Une erreur inattendue est survenue';
      details = {
        error: 'UNKNOWN_ERROR',
        message: exception.message,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      };
    }

    // Format de réponse JSON structuré
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: message,
      ...(details && { details }),
    };

    // Log de l'erreur en développement
    if (process.env.NODE_ENV === 'development') {
      console.error('Exception caught:', exception);
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Extrait le nom du champ dupliqué depuis le message d'erreur MongoDB
   */
  private extractDuplicateField(errorMessage: string): string | null {
    // Format: E11000 duplicate key error collection: gesmut.directions index: code_1 dup key: { code: "D-002" }
    const match = errorMessage.match(/index:\s*(\w+)_\d+\s+dup key/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Format alternatif: dup key: { code: "D-002" }
    const altMatch = errorMessage.match(/dup key:\s*\{\s*(\w+):/);
    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }
    
    return null;
  }

  /**
   * Extrait l'erreur MongoDB depuis une exception (peut être encapsulée par Mongoose)
   */
  private getMongoError(exception: unknown): MongoError | null {
    // Erreur MongoDB directe
    if (exception instanceof MongoError) {
      return exception;
    }

    // Erreur Mongoose qui encapsule une erreur MongoDB
    if (exception && typeof exception === 'object' && 'name' in exception) {
      const error = exception as any;
      
      // Mongoose ValidationError
      if (error.name === 'MongoServerError' || error.name === 'MongoError') {
        return error as MongoError;
      }

      // Mongoose peut encapsuler l'erreur dans error.errors ou directement
      if (error.errors) {
        const firstError = Object.values(error.errors)[0] as any;
        if (firstError && firstError.name === 'MongoServerError') {
          return firstError as MongoError;
        }
      }

      // Vérifier si l'erreur a un code MongoDB (11000, etc.)
      if (error.code && (error.code === 11000 || error.code === 11001 || error.code === 16755)) {
        return error as MongoError;
      }
    }

    return null;
  }
}

