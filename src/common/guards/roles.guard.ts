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
    // Gérer les rôles multiples : utiliser roles si disponible, sinon role pour compatibilité
    const userRoles = user.roles && Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles
      : user.role
        ? [user.role] // Compatibilité avec ancien format
        : [];
    
    // Comparaison insensible à la casse pour plus de robustesse
    const userRolesUpper = userRoles.map((r: string) => r.toUpperCase());
    const hasAccess = requiredRoles.some((role) => 
      userRolesUpper.includes(role.toUpperCase())
    );
    
    if (!hasAccess) {
      console.warn('RolesGuard: Accès refusé', {
        userRoles: userRoles,
        requiredRoles,
        userId: user._id || user.id,
      });
    }
    
    return hasAccess;
  }
}

