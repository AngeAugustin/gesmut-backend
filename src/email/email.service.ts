import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.SMTP_FROM_NAME || process.env.RESEND_FROM_NAME || 'GESMUT';

    // Priorité à Resend si la clé API est fournie
    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
      this.logger.log('✅ Service email configuré avec Resend API');
      this.logger.log('Configuration Resend:', {
        fromEmail,
        fromName,
      });
    } else if (fromEmail) {
      // Fallback: essayer avec SMTP si Resend n'est pas configuré
      this.logger.warn('⚠️ RESEND_API_KEY non trouvé. Utilisation de SMTP (peut ne pas fonctionner sur Render gratuit)');
      this.logger.warn('Pour une meilleure fiabilité, configurez RESEND_API_KEY. Voir CONFIGURATION_SMTP_ALTERNATIVES.md');
    } else {
      this.logger.warn('⚠️ Configuration email incomplète. Les emails ne pourront pas être envoyés.');
      this.logger.warn('Variables requises: RESEND_API_KEY (recommandé) ou SMTP_*');
    }
  }

  /**
   * Envoie un email avec des pièces jointes
   */
  async sendEmailWithAttachments({
    to,
    subject,
    html,
    attachments = [],
  }: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<any> {
    const fromEmail = process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL;
    const fromName = process.env.SMTP_FROM_NAME || process.env.RESEND_FROM_NAME || 'GESMUT';
    const recipients = Array.isArray(to) ? to : [to];

    // Utiliser Resend si disponible (recommandé)
    if (this.resend && fromEmail) {
      try {
        this.logger.log('Envoi d\'email via Resend API:', {
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject,
          attachmentsCount: attachments.length,
        });

        const startTime = Date.now();

        const emailData: any = {
          from: `${fromName} <${fromEmail}>`,
          to: recipients,
          subject,
          html,
        };

        // Ajouter les pièces jointes si présentes
        if (attachments.length > 0) {
          emailData.attachments = attachments.map(att => ({
            filename: att.filename,
            content: att.content, // Resend accepte directement les Buffer
          }));
        }

        const result = await this.resend.emails.send(emailData);
        const duration = Date.now() - startTime;

        this.logger.log(`✅ Email envoyé avec succès via Resend en ${duration}ms`);
        this.logger.log('Détails:', {
          id: result.data?.id,
          to: recipients,
        });

        return {
          success: true,
          id: result.data?.id,
        };
      } catch (error) {
        this.logger.error('❌ Erreur lors de l\'envoi via Resend:', error);
        this.logger.error('Message:', error.message);
        throw new Error(`Erreur lors de l'envoi de l'email via Resend: ${error.message}`);
      }
    }

    // Fallback vers SMTP si Resend n'est pas configuré
    throw new Error('Service email non configuré. Veuillez définir RESEND_API_KEY dans les variables d\'environnement. Voir CONFIGURATION_SMTP_ALTERNATIVES.md');
  }

  /**
   * Envoie les documents de décision finale à l'agent
   */
  async sendDecisionDocuments({
    agentEmail,
    agentName,
    decision,
    documents = [],
  }: {
    agentEmail: string;
    agentName: string;
    decision: 'ACCEPTEE' | 'REJETEE';
    documents: Array<{ name: string; buffer: Buffer }>;
  }): Promise<any> {
    const subject = decision === 'ACCEPTEE' 
      ? 'Décision favorable - Documents de mutation'
      : 'Décision - Demande de mutation';

    const html = decision === 'ACCEPTEE'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #008751;">Décision favorable</h2>
          <p>Bonjour ${agentName},</p>
          <p>Votre demande de mutation a été acceptée.</p>
          <p>Veuillez trouver ci-joint les documents officiels :</p>
          <ul>
            <li>Ordre de mutation</li>
            <li>Lettre de notification</li>
            <li>Attestation administrative</li>
          </ul>
          <p>Cordialement,<br>Direction Nationale du Contrôle Financier</p>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Décision</h2>
          <p>Bonjour ${agentName},</p>
          <p>Votre demande de mutation a été rejetée.</p>
          <p>Cordialement,<br>Direction Nationale du Contrôle Financier</p>
        </div>
      `;

    this.logger.log('Préparation de l\'envoi des documents:', {
      agentEmail,
      agentName,
      decision,
      documentsCount: documents.length,
      documentsNames: documents.map(d => d.name),
    });

    const attachments = documents.map(doc => ({
      filename: doc.name,
      content: doc.buffer,
    }));

    this.logger.log('Attachments préparés:', attachments.map(a => ({ filename: a.filename, size: a.content.length })));

    return this.sendEmailWithAttachments({
      to: agentEmail,
      subject,
      html,
      attachments,
    });
  }

  /**
   * Envoie un email de confirmation après la création d'une demande de mutation
   */
  async sendDemandeConfirmation({
    agentEmail,
    agentName,
    demandeId,
    demandeDetails,
  }: {
    agentEmail: string;
    agentName: string;
    demandeId: string;
    demandeDetails: {
      motif?: string;
      type?: string;
      statut?: string;
      posteSouhaite?: string;
      localisationSouhaitee?: string;
      dateCreation?: string;
    };
  }): Promise<any> {
    const subject = 'Confirmation de réception de votre demande de mutation';

    // Formater les détails de la demande
    const detailsHtml = `
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="color: #008751; margin-top: 0;">Détails de votre demande</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; font-weight: bold; width: 200px;">Identifiant de la demande :</td>
            <td style="padding: 8px;"><strong style="color: #008751;">${demandeId}</strong></td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Type de mutation :</td>
            <td style="padding: 8px;">${demandeDetails.type === 'SIMPLE' ? 'Mutation simple' : 'Mutation stratégique'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold;">Statut :</td>
            <td style="padding: 8px;">${demandeDetails.statut || 'Brouillon'}</td>
          </tr>
          ${demandeDetails.motif ? `
          <tr>
            <td style="padding: 8px; font-weight: bold;">Motif :</td>
            <td style="padding: 8px;">${demandeDetails.motif}</td>
          </tr>
          ` : ''}
          ${demandeDetails.posteSouhaite ? `
          <tr>
            <td style="padding: 8px; font-weight: bold;">Poste souhaité :</td>
            <td style="padding: 8px;">${demandeDetails.posteSouhaite}</td>
          </tr>
          ` : ''}
          ${demandeDetails.localisationSouhaitee ? `
          <tr>
            <td style="padding: 8px; font-weight: bold;">Localisation souhaitée :</td>
            <td style="padding: 8px;">${demandeDetails.localisationSouhaitee}</td>
          </tr>
          ` : ''}
          ${demandeDetails.dateCreation ? `
          <tr>
            <td style="padding: 8px; font-weight: bold;">Date de création :</td>
            <td style="padding: 8px;">${demandeDetails.dateCreation}</td>
          </tr>
          ` : ''}
        </table>
      </div>
    `;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #008751;">Confirmation de réception</h2>
        <p>Bonjour ${agentName},</p>
        <p>Nous avons bien reçu votre demande de mutation. Votre demande a été enregistrée avec succès.</p>
        ${detailsHtml}
        <p style="margin-top: 20px;"><strong>Important :</strong> Conservez précieusement cet identifiant de demande (<strong>${demandeId}</strong>) pour suivre l'évolution de votre demande.</p>
        <p>Vous pouvez suivre l'état de votre demande en utilisant l'identifiant ci-dessus sur notre plateforme de suivi.</p>
        <p style="margin-top: 30px;">Cordialement,<br><strong>Direction Nationale du Contrôle Financier</strong></p>
      </div>
    `;

    this.logger.log('Envoi de l\'email de confirmation de demande:', {
      agentEmail,
      agentName,
      demandeId,
    });

    return this.sendEmailWithAttachments({
      to: agentEmail,
      subject,
      html,
      attachments: [],
    });
  }

  /**
   * Envoie un code de réinitialisation de mot de passe
   */
  async sendPasswordResetCode({
    email,
    code,
    userName,
  }: {
    email: string;
    code: string;
    userName: string;
  }): Promise<any> {
    const subject = 'Code de réinitialisation de mot de passe';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #008751;">Réinitialisation de mot de passe</h2>
        <p>Bonjour ${userName},</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe. Utilisez le code suivant pour procéder à la réinitialisation :</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <h1 style="color: #008751; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p style="color: #d32f2f;"><strong>Important :</strong></p>
        <ul>
          <li>Ce code est valide pendant <strong>15 minutes</strong> uniquement</li>
          <li>Ne partagez jamais ce code avec personne</li>
          <li>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email</li>
        </ul>
        <p style="margin-top: 30px;">Cordialement,<br><strong>Direction Nationale du Contrôle Financier</strong></p>
      </div>
    `;

    this.logger.log('Envoi du code de réinitialisation:', {
      email,
      code,
    });

    return this.sendEmailWithAttachments({
      to: email,
      subject,
      html,
      attachments: [],
    });
  }
}

