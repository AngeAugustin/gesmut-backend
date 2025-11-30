import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DNCF)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send-decision-documents')
  async sendDecisionDocuments(@Body() body: {
    agentEmail: string;
    agentName: string;
    decision: 'ACCEPTEE' | 'REJETEE';
    documents: Array<{ name: string; buffer: string }>; // Buffer en base64
  }) {
    console.log('Reçu demande d\'envoi d\'email:', {
      agentEmail: body.agentEmail,
      agentName: body.agentName,
      decision: body.decision,
      documentsCount: body.documents?.length || 0,
      documentsNames: body.documents?.map(d => d.name) || [],
    });

    // Convertir les buffers base64 en Buffer
    const documents = body.documents.map(doc => ({
      name: doc.name,
      buffer: Buffer.from(doc.buffer, 'base64'),
    }));

    console.log('Documents convertis, tailles des buffers:', documents.map(d => ({ name: d.name, size: d.buffer.length })));

    try {
      const result = await this.emailService.sendDecisionDocuments({
        agentEmail: body.agentEmail,
        agentName: body.agentName,
        decision: body.decision,
        documents,
      });
      console.log('Email envoyé avec succès depuis le contrôleur:', result);
      return result;
    } catch (error) {
      console.error('Erreur dans le contrôleur email:', error);
      throw error;
    }
  }
}

