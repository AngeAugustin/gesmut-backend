import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Role } from '../common/enums/roles.enum';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const user = await this.usersService.validateUser(loginDto.email, loginDto.password);
      if (!user) {
        throw new UnauthorizedException('Identifiants invalides');
      }

      const userDoc = user as UserDocument;

      // Mettre à jour la dernière connexion
      await this.usersService.update(userDoc._id.toString(), { lastLogin: new Date() });

      // Gérer les rôles multiples : utiliser roles si disponible, sinon role pour compatibilité
      const userRoles = (userDoc.roles && Array.isArray(userDoc.roles) && userDoc.roles.length > 0)
        ? userDoc.roles
        : (userDoc.role ? [userDoc.role] : []);
      const primaryRole = userRoles[0] || 'AGENT'; // Rôle principal pour le JWT (compatibilité)
      
      const payload = { email: userDoc.email, sub: userDoc._id.toString(), roles: userRoles, role: primaryRole };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: userDoc._id.toString(),
          email: userDoc.email,
          nom: userDoc.nom,
          prenom: userDoc.prenom,
          roles: userRoles,
          role: primaryRole, // Rôle principal pour compatibilité frontend
          serviceId: userDoc.serviceId,
          directionId: userDoc.directionId,
          agentId: userDoc.agentId,
        },
      };
    } catch (error) {
      // Si l'erreur est liée au compte non actif, la propager
      if (error.message && error.message.includes('Compte non actif')) {
        throw new UnauthorizedException('Compte non actif. Veuillez contacter l\'administrateur.');
      }
      throw error;
    }
  }

  async register(registerDto: RegisterDto, createdByAdmin: boolean = false) {
    // Empêcher la création de comptes avec le rôle AGENT
    if (registerDto.roles.includes(Role.AGENT)) {
      throw new BadRequestException('Les agents ne peuvent pas créer de compte. Utilisez le formulaire public pour faire une demande.');
    }

    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('Cet email est déjà utilisé');
    }

    // Déterminer si le compte doit être actif
    // Si isActive est explicitement fourni dans le DTO, l'utiliser
    // Sinon, utiliser createdByAdmin (false pour auto-inscription, true pour admin)
    const shouldBeActive = registerDto.isActive !== undefined ? registerDto.isActive : createdByAdmin;
    
    // Créer le compte avec le bon statut isActive
    const user = await this.usersService.create(registerDto, shouldBeActive);
    const userDoc = user as UserDocument;

    // Si le compte est créé par auto-inscription (pas par admin), notifier les admins
    if (!createdByAdmin && !shouldBeActive) {
      try {
        // Trouver tous les admins
        const admins = await this.usersService.findAll();
        const adminUsers = admins.filter(u => {
          const userRoles = (u.roles && Array.isArray(u.roles) && u.roles.length > 0)
            ? u.roles
            : (u.role ? [u.role] : []);
          return userRoles.includes(Role.ADMIN) && u.isActive;
        });
        
        // Créer une notification pour chaque admin
        const userRoles = (userDoc.roles && Array.isArray(userDoc.roles) && userDoc.roles.length > 0)
          ? userDoc.roles
          : (userDoc.role ? [userDoc.role] : []);
        const rolesLabel = userRoles.join(', ');
        
        for (const admin of adminUsers) {
          const adminId = (admin as any)._id?.toString();
          if (!adminId) continue; // Ignorer si pas d'ID
          await this.notificationsService.create({
            destinataireId: adminId,
            type: 'IN_APP',
            titre: 'Nouveau compte en attente de validation',
            contenu: `Un nouvel utilisateur (${userDoc.prenom} ${userDoc.nom} - ${userDoc.email}) avec le(s) rôle(s) ${rolesLabel} a créé un compte et attend votre validation.`,
            actionUrl: `/admin/utilisateurs`,
          });
        }
      } catch (error) {
        // Ne pas faire échouer l'inscription si la notification échoue
        console.error('Erreur lors de la création de la notification pour les admins:', error);
      }
    }

    // Gérer les rôles multiples
    const userRoles = (userDoc.roles && Array.isArray(userDoc.roles) && userDoc.roles.length > 0)
      ? userDoc.roles
      : (userDoc.role ? [userDoc.role] : []);
    const primaryRole = userRoles[0] || 'AGENT';
    
    // Si créé par admin ou si isActive est true, retourner le token directement
    if (createdByAdmin || shouldBeActive) {
      const payload = { email: userDoc.email, sub: userDoc._id.toString(), roles: userRoles, role: primaryRole };
      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: userDoc._id.toString(),
          email: userDoc.email,
          nom: userDoc.nom,
          prenom: userDoc.prenom,
          roles: userRoles,
          role: primaryRole,
          serviceId: userDoc.serviceId,
          directionId: userDoc.directionId,
          agentId: userDoc.agentId,
        },
      };
    }

    // Si auto-inscription, ne pas retourner de token (compte non actif)
    return {
      message: 'Votre compte a été créé avec succès. Il sera activé après validation par un administrateur. Vous recevrez un email de confirmation une fois votre compte activé.',
      user: {
        id: userDoc._id.toString(),
        email: userDoc.email,
        nom: userDoc.nom,
        prenom: userDoc.prenom,
        roles: userRoles,
        role: primaryRole,
        serviceId: userDoc.serviceId,
        directionId: userDoc.directionId,
        agentId: userDoc.agentId,
        isActive: false,
      },
    };
  }

  async validateToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}

