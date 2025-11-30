import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PasswordReset, PasswordResetDocument } from './schemas/password-reset.schema';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectModel(PasswordReset.name) private passwordResetModel: Model<PasswordResetDocument>,
    private emailService: EmailService,
    private usersService: UsersService,
  ) {}

  /**
   * Génère un code de réinitialisation à 6 chiffres
   */
  private generateResetCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Demande un code de réinitialisation pour un email
   */
  async requestResetCode(email: string): Promise<void> {
    // Vérifier que l'utilisateur existe
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Ne pas révéler que l'email n'existe pas pour des raisons de sécurité
      this.logger.warn(`Tentative de réinitialisation pour un email inexistant: ${email}`);
      return; // Retourner silencieusement pour ne pas révéler l'existence de l'email
    }

    // Générer un code à 6 chiffres
    const code = this.generateResetCode();
    
    // Définir l'expiration à 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Supprimer les anciens codes non utilisés pour cet email
    await this.passwordResetModel.deleteMany({
      email,
      used: false,
    });

    // Créer un nouveau code
    const passwordReset = new this.passwordResetModel({
      email,
      code,
      expiresAt,
      used: false,
    });

    await passwordReset.save();

    // Envoyer l'email avec le code
    try {
      await this.emailService.sendPasswordResetCode({
        email,
        code,
        userName: `${user.prenom} ${user.nom}`,
      });

      this.logger.log(`Code de réinitialisation envoyé à ${email}`);
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi du code de réinitialisation: ${error.message}`);
      // Supprimer le code si l'email n'a pas pu être envoyé
      await this.passwordResetModel.deleteOne({ _id: passwordReset._id });
      throw new BadRequestException('Impossible d\'envoyer le code de réinitialisation. Veuillez réessayer plus tard.');
    }
  }

  /**
   * Vérifie le code et réinitialise le mot de passe
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    // Vérifier que le code existe et est valide
    const passwordReset = await this.passwordResetModel.findOne({
      email,
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!passwordReset) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    // Vérifier que l'utilisateur existe
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Mettre à jour le mot de passe
    const userDoc = user as any; // UserDocument
    await this.usersService.updatePassword(userDoc._id.toString(), newPassword);

    // Marquer le code comme utilisé
    passwordReset.used = true;
    await passwordReset.save();

    this.logger.log(`Mot de passe réinitialisé pour ${email}`);
  }
}

