import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/roles.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      console.warn('RolesGuard: Aucun utilisateur trouvé dans la requête');
      return false;
    }
    // Comparaison insensible à la casse pour plus de robustesse
    const userRole = user.role?.toUpperCase();
    const hasAccess = requiredRoles.some((role) => userRole === role.toUpperCase());
    
    if (!hasAccess) {
      console.warn('RolesGuard: Accès refusé', {
        userRole: user.role,
        requiredRoles,
        userId: user._id || user.id,
      });
    }
    
    return hasAccess;
  }
}

