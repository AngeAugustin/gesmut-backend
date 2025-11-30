import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditService } from '../../audit/audit.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => AuditService))
    private auditService: AuditService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // Ignorer les routes publiques ou certaines routes
    const url = request.url;
    const shouldSkip = 
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/files/') ||
      url.includes('/upload') ||
      url === '/' ||
      url.includes('/audit') || // Ne pas logger les logs eux-mêmes
      url.includes('/health') ||
      url.includes('/favicon.ico');
    
    if (shouldSkip) {
      return next.handle();
    }

    // Extraire l'IP de la requête (gérer les proxies)
    const getClientIp = (req: Request): string => {
      const forwarded = req.headers['x-forwarded-for'];
      if (forwarded) {
        const ips = forwarded.toString().split(',');
        return ips[0].trim();
      }
      const realIp = req.headers['x-real-ip'];
      if (realIp) {
        return realIp.toString();
      }
      const reqAny = req as any;
      return reqAny.ip || reqAny.connection?.remoteAddress || reqAny.socket?.remoteAddress || 'unknown';
    };
    const ip = getClientIp(request);

    // Extraire les informations utilisateur
    const user = (request as any).user;
    const userId = user?.sub || user?._id || user?.id;
    const userEmail = user?.email;
    const userRole = user?.role;

    // Déterminer le module et l'action à partir de l'URL
    const module = this.getModuleFromUrl(url);
    const action = this.getActionFromMethod(request.method, url);

    // Extraire le corps de la requête (pour POST, PUT, PATCH)
    let requestBody = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      requestBody = request.body;
      // Ne pas logger les mots de passe
      if (requestBody?.password) {
        requestBody = { ...requestBody, password: '***' };
      }
    }

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Logger l'action réussie (de manière asynchrone et non bloquante)
        this.auditService.log(
          action,
          module,
          userId,
          {
            success: true,
            message: `${action} effectué avec succès`,
          },
          ip,
          request.headers['user-agent'],
          {
            userEmail,
            userRole,
            method: request.method,
            url: request.url,
            statusCode,
            requestBody,
            responseData: this.sanitizeResponseData(data),
            duration,
          },
        ).catch((err) => {
          // Ne pas bloquer la requête si le logging échoue
          console.error('Erreur lors du logging:', err);
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;

        // Logger l'erreur (de manière asynchrone et non bloquante)
        this.auditService.log(
          `${action}_ERROR`,
          module,
          userId,
          {
            success: false,
            error: error.message,
          },
          ip,
          request.headers['user-agent'],
          {
            userEmail,
            userRole,
            method: request.method,
            url: request.url,
            statusCode,
            requestBody,
            duration,
            error: error.message || 'Erreur inconnue',
          },
        ).catch((err) => {
          // Ne pas bloquer la requête si le logging échoue
          console.error('Erreur lors du logging d\'erreur:', err);
        });

        throw error;
      }),
    );
  }

  private getModuleFromUrl(url: string): string {
    if (url.includes('/demandes')) return 'DEMANDES';
    if (url.includes('/agents')) return 'AGENTS';
    if (url.includes('/postes')) return 'POSTES';
    if (url.includes('/validations')) return 'VALIDATIONS';
    if (url.includes('/documents')) return 'DOCUMENTS';
    if (url.includes('/notifications')) return 'NOTIFICATIONS';
    if (url.includes('/referentiels')) return 'REFERENTIELS';
    if (url.includes('/workflow')) return 'WORKFLOW';
    if (url.includes('/users') || url.includes('/utilisateurs')) return 'USERS';
    if (url.includes('/auth')) return 'AUTH';
    return 'SYSTEM';
  }

  private getActionFromMethod(method: string, url: string): string {
    if (method === 'GET') {
      if (url.includes('/eligibles') || url.includes('/search')) return 'SEARCH';
      if (url.includes('/count') || url.includes('/stats')) return 'VIEW_STATS';
      return 'VIEW';
    }
    if (method === 'POST') {
      if (url.includes('/login')) return 'LOGIN';
      if (url.includes('/register')) return 'REGISTER';
      if (url.includes('/import')) return 'IMPORT';
      if (url.includes('/export')) return 'EXPORT';
      if (url.includes('/signer')) return 'SIGN';
      return 'CREATE';
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (url.includes('/lu') || url.includes('/read')) return 'MARK_READ';
      if (url.includes('/activate') || url.includes('/deactivate')) return 'TOGGLE_STATUS';
      return 'UPDATE';
    }
    if (method === 'DELETE') return 'DELETE';
    return 'UNKNOWN';
  }

  private sanitizeResponseData(data: any): any {
    if (!data) return null;
    
    // Limiter la taille des données de réponse
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 1000) {
      return { message: 'Response data too large to log', size: dataStr.length };
    }
    
    // Ne pas logger les tokens
    if (data?.access_token) {
      return { ...data, access_token: '***' };
    }
    
    return data;
  }
}

