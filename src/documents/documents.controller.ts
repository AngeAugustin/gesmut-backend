import { Controller, Get, Post, Body, Param, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/roles.enum';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DNCF, Role.CVR, Role.DGR)
  create(@Body() createDto: { type: string; demandeId: string; format: 'PDF' | 'EXCEL'; data: any; fichierId?: string }) {
    return this.documentsService.create(createDto.type, createDto.demandeId, createDto.format, createDto.data, createDto.fichierId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.documentsService.findAll();
  }

  @Post('generate/:type/:demandeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DNCF)
  async generateDocument(
    @Param('type') type: string,
    @Param('demandeId') demandeId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    try {
      const demande = await this.documentsService['demandesService']?.findOne(demandeId);
      
      if (!demande) {
        return res.status(404).json({ error: 'Demande non trouvée' });
      }

      const pdfBuffer = await this.documentsService.generateRealPDF(type, demande, user.id);
      const filename = this.getDocumentFilename(type);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur lors de la génération du document:', error);
      res.status(500).json({
        error: 'Erreur lors de la génération du document',
        message: error.message,
      });
    }
  }

  @Get('test/:type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DNCF, Role.DGR)
  async generateTestDocument(@Param('type') type: string, @Res() res: Response) {
    console.log('Route test/:type appelée avec type:', type);
    try {
      const pdfBuffer = await this.documentsService.generateTestPDF(type);
      const filename = this.getDocumentFilename(type);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur lors de la génération du document de test:', error);
      res.status(500).json({
        error: 'Erreur lors de la génération du document',
        message: error.message,
      });
    }
  }

  // Endpoint public pour récupérer les documents d'une demande (uniquement si la décision est rendue)
  // DOIT être défini AVANT les routes paramétrées comme :id
  @Get('public/demande/:demandeId')
  async findPublicByDemande(@Param('demandeId') demandeId: string) {
    // Vérifier que la demande existe et que la décision est rendue
    const demande = await this.documentsService['demandesService']?.findOne(demandeId);
    if (!demande) {
      throw new Error('Demande non trouvée');
    }
    
    // Ne retourner les documents que si la décision est rendue
    if (demande.statut !== 'ACCEPTEE' && demande.statut !== 'REJETEE') {
      return [];
    }
    
    return this.documentsService.findByDemande(demandeId);
  }

  // Endpoint public pour télécharger un document (uniquement si la décision est rendue)
  // DOIT être défini AVANT les routes paramétrées comme :id
  @Get('public/:id/download')
  async downloadPublic(@Param('id') id: string, @Res() res: Response) {
    try {
      const document = await this.documentsService.findOne(id);
      if (!document) {
        return res.status(404).json({ error: 'Document non trouvé' });
      }

      // Vérifier que la demande existe et que la décision est rendue
      const demande = await this.documentsService['demandesService']?.findOne(document.demandeId.toString());
      if (!demande || (demande.statut !== 'ACCEPTEE' && demande.statut !== 'REJETEE')) {
        return res.status(403).json({ error: 'Document non accessible' });
      }

      const { stream, filename, contentType } = await this.documentsService.getFile(document.fichierId);
      res.setHeader('Content-Type', contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || document.type}.pdf"`);
      stream.pipe(res);
    } catch (error) {
      console.error('Erreur lors du téléchargement public:', error);
      return res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
  }

  @Get('demande/:demandeId')
  @UseGuards(JwtAuthGuard)
  findByDemande(@Param('demandeId') demandeId: string) {
    return this.documentsService.findByDemande(demandeId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DNCF, Role.DGR, Role.CVR, Role.RESPONSABLE)
  async findOne(@Param('id') id: string, @Res() res?: Response) {
    const document = await this.documentsService.findOne(id);
    if (!document) {
      if (res) {
        return res.status(404).json({ error: 'Document non trouvé' });
      }
      throw new Error('Document non trouvé');
    }
    
    // Si res est fourni, télécharger le fichier
    if (res) {
      const { stream, filename, contentType } = await this.documentsService.getFile(document.fichierId);
      res.setHeader('Content-Type', contentType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename || document.type}.pdf"`);
      stream.pipe(res);
    } else {
      return document;
    }
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.DNCF, Role.DGR, Role.CVR, Role.RESPONSABLE)
  async download(@Param('id') id: string, @Res() res: Response) {
    return this.findOne(id, res);
  }

  @Post(':id/signer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DNCF)
  signer(@Param('id') id: string, @Body() body: { signatureImageId: string }, @CurrentUser() user: any) {
    return this.documentsService.signer(id, body.signatureImageId, user.id);
  }

  private getDocumentFilename(type: string): string {
    const filenames: { [key: string]: string } = {
      'ORDRE_MUTATION': 'Ordre_de_mutation.pdf',
      'LETTRE_NOTIFICATION': 'Lettre_de_notification.pdf',
      'ATTESTATION_ADMINISTRATIVE': 'Attestation_administrative.pdf',
    };
    return filenames[type] || `${type}.pdf`;
  }
}

