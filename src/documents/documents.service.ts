import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
const PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentSchema, DocumentDocument } from './schemas/document.schema';
import { UploadService } from '../upload/upload.service';
import { DemandesService } from '../demandes/demandes.service';
import { UsersService } from '../users/users.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(DocumentSchema.name) private documentModel: Model<DocumentDocument>,
    private uploadService: UploadService,
    private demandesService: DemandesService,
    private usersService: UsersService,
    private agentsService: AgentsService,
  ) {}

  async generatePDF(type: string, data: any, template?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        const file = {
          originalname: `${type}_${Date.now()}.pdf`,
          mimetype: 'application/pdf',
          buffer,
        };
        const fileId = await this.uploadService.uploadFile(file as Express.Multer.File);
        resolve(fileId);
      });
      doc.on('error', reject);

      // Contenu du document (à personnaliser selon le template)
      doc.fontSize(20).text(`Document ${type}`, 100, 100);
      doc.fontSize(12).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 100, 150);
      
      if (data.agent) {
        doc.text(`Agent: ${data.agent.nom} ${data.agent.prenom}`, 100, 200);
      }
      if (data.demande) {
        doc.text(`Demande: ${data.demande.motif}`, 100, 250);
      }

      doc.end();
    });
  }

  async generateExcel(type: string, data: any): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rapport');

    // En-têtes
    worksheet.columns = [
      { header: 'Colonne 1', key: 'col1', width: 30 },
      { header: 'Colonne 2', key: 'col2', width: 30 },
    ];

    // Données (exemple)
    worksheet.addRow({ col1: 'Valeur 1', col2: 'Valeur 2' });

    const buffer = await workbook.xlsx.writeBuffer();
    const file = {
      originalname: `${type}_${Date.now()}.xlsx`,
      mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(buffer),
    };
    return this.uploadService.uploadFile(file as Express.Multer.File);
  }

  async create(type: string, demandeId: string, format: 'PDF' | 'EXCEL', data: any, fichierId?: string): Promise<DocumentSchema> {
    let fileId: string;
    if (fichierId) {
      // Utiliser le fichierId fourni (déjà uploadé)
      fileId = fichierId;
    } else {
      // Générer le document et uploader
      if (format === 'PDF') {
        fileId = await this.generatePDF(type, data);
      } else {
        fileId = await this.generateExcel(type, data);
      }
    }

    const document = new this.documentModel({
      type,
      demandeId,
      contenu: JSON.stringify(data),
      fichierId: fileId,
      format,
    });
    return document.save();
  }

  async signer(documentId: string, signatureImageId: string, signataireId: string): Promise<DocumentSchema> {
    const document = await this.documentModel.findById(documentId);
    if (!document) {
      throw new Error('Document non trouvé');
    }
    document.signatureImageId = signatureImageId;
    document.signataireId = signataireId;
    document.dateSignature = new Date();
    return document.save();
  }

  async findAll(): Promise<DocumentSchema[]> {
    return this.documentModel.find().populate('demandeId signataireId').exec();
  }

  async findByDemande(demandeId: string): Promise<DocumentSchema[]> {
    return this.documentModel.find({ demandeId }).exec();
  }

  async findOne(id: string): Promise<DocumentSchema | null> {
    return this.documentModel.findById(id).populate('demandeId signataireId').exec();
  }

  async getFile(fileId: string): Promise<{ stream: NodeJS.ReadableStream; filename: string; contentType: string }> {
    return this.uploadService.getFile(fileId);
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async generateRealPDF(type: string, demandeData: any, dncfUserId?: string): Promise<Buffer> {
    // Charger la signature et le cachet du DNCF si disponibles
    let signatureBuffer: Buffer | null = null;
    let cachetBuffer: Buffer | null = null;

    if (dncfUserId) {
      try {
        const dncfUser = await this.usersService.findOne(dncfUserId);
        if (dncfUser) {
          // Charger la signature
          if (dncfUser.signatureImageId) {
            try {
              const { stream: signatureStream } = await this.uploadService.getFile(dncfUser.signatureImageId);
              signatureBuffer = await this.streamToBuffer(signatureStream);
            } catch (sigError) {
              console.warn('Erreur lors du chargement de la signature:', sigError);
            }
          }

          // Charger le cachet
          if (dncfUser.cachetImageId) {
            try {
              const { stream: cachetStream } = await this.uploadService.getFile(dncfUser.cachetImageId);
              cachetBuffer = await this.streamToBuffer(cachetStream);
            } catch (cachetError) {
              console.warn('Erreur lors du chargement du cachet:', cachetError);
            }
          }
        }
      } catch (userError) {
        console.warn('Erreur lors de la récupération des données DNCF:', userError);
      }
    }

    // Préparer les données réelles depuis la demande
    let agentInfo = demandeData.agentId || demandeData.informationsAgent;
    
    // Si agentId existe, récupérer l'agent depuis la base de données pour avoir toutes les références populées
    if (demandeData.agentId) {
      try {
        let agentId: string;
        // Extraire l'ID de l'agent (peut être un objet ou un string)
        if (typeof demandeData.agentId === 'string') {
          agentId = demandeData.agentId;
        } else if (typeof demandeData.agentId === 'object' && demandeData.agentId !== null) {
          agentId = (demandeData.agentId as any)._id?.toString() || (demandeData.agentId as any).id?.toString();
        }
        
        if (agentId) {
          const agentFull = await this.agentsService.findOne(agentId);
          if (agentFull) {
            agentInfo = agentFull;
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la récupération de l\'agent:', error);
      }
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Document Administratif',
          Author: 'Direction Nationale du Contrôle Financier',
          Subject: 'Document officiel',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);
      
      const agentNom = agentInfo?.nom || '';
      const agentPrenom = agentInfo?.prenom || '';
      const matricule = agentInfo?.matricule || '';
      
      // Récupérer les informations du poste et localisation
      const poste = demandeData.posteSouhaiteId;
      const posteLibelle = typeof poste === 'object' && poste !== null ? poste.intitule : 'Non spécifié';
      
      // Récupérer le service du poste de destination
      let serviceDestination = 'Non spécifié';
      if (typeof poste === 'object' && poste !== null && poste.serviceId) {
        const servicePoste = poste.serviceId;
        if (typeof servicePoste === 'object' && servicePoste !== null) {
          serviceDestination = servicePoste.libelle || 'Non spécifié';
        } else {
          serviceDestination = servicePoste?.toString() || 'Non spécifié';
        }
      }
      
      // Récupérer la localisation du poste de destination
      let localisationDestination = 'Non spécifiée';
      if (typeof poste === 'object' && poste !== null && poste.localisationId) {
        const localisationPoste = poste.localisationId;
        if (typeof localisationPoste === 'object' && localisationPoste !== null) {
          localisationDestination = localisationPoste.libelle || 'Non spécifiée';
        } else {
          localisationDestination = localisationPoste?.toString() || 'Non spécifiée';
        }
      }
      
      // Si la localisation du poste n'est pas disponible, utiliser celle de la demande en fallback
      if (localisationDestination === 'Non spécifiée') {
        const localisations = demandeData.localisationsSouhaitees || (demandeData.localisationSouhaiteId ? [demandeData.localisationSouhaiteId] : []);
        const localisationsLibelles = Array.isArray(localisations)
          ? localisations
              .map((loc) => {
                if (typeof loc === 'object' && loc !== null) {
                  return loc.libelle || '';
                }
                return '';
              })
              .filter((lib) => lib !== '')
          : [];
        if (localisationsLibelles.length > 0) {
          localisationDestination = localisationsLibelles.join(', ');
        }
      }
      
      // Informations de l'agent (si agentId est populé)
      const grade = typeof agentInfo?.gradeId === 'object' && agentInfo?.gradeId !== null ? agentInfo.gradeId.libelle : 'Non spécifié';
      const serviceActuel = typeof agentInfo?.serviceId === 'object' && agentInfo?.serviceId !== null ? agentInfo.serviceId.libelle : 'Non spécifié';
      const localisationActuelle = typeof agentInfo?.localisationActuelleId === 'object' && agentInfo?.localisationActuelleId !== null ? agentInfo.localisationActuelleId.libelle : 'Non spécifiée';
      
      console.log('Agent info pour document:', {
        agentId: demandeData.agentId,
        gradeId: agentInfo?.gradeId,
        serviceId: agentInfo?.serviceId,
        statutId: agentInfo?.statutId,
        localisationActuelleId: agentInfo?.localisationActuelleId,
        grade,
        serviceActuel,
        localisationActuelle,
      });
      
      // Préparer les données pour le document
      const realData = {
        numero: `DNCF-${demandeData._id?.toString().substring(0, 8).toUpperCase() || 'XXXX'}`,
        nomAgent: agentNom,
        prenomAgent: agentPrenom,
        matricule: matricule,
        grade: grade,
        serviceActuel: serviceActuel,
        localisationActuelle: localisationActuelle,
        posteSouhaite: posteLibelle,
        serviceDestination: serviceDestination,
        localisationDestination: localisationDestination,
        dateEffet: (() => {
          // Utiliser la date de mutation si elle existe, sinon utiliser la date actuelle (mutation immédiate)
          if (demandeData.dateMutation) {
            const dateMutation = demandeData.dateMutation instanceof Date 
              ? demandeData.dateMutation 
              : new Date(demandeData.dateMutation);
            return dateMutation.toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          } else {
            // Mutation immédiate : utiliser la date actuelle
            return new Date().toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        })(),
        dateNaissance: agentInfo?.dateNaissance 
          ? (agentInfo.dateNaissance instanceof Date 
              ? agentInfo.dateNaissance.toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              : new Date(agentInfo.dateNaissance).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }))
          : 'Non spécifiée',
        lieuNaissance: agentInfo?.lieuNaissance || 'Non spécifié',
        statut: typeof agentInfo?.statutId === 'object' && agentInfo?.statutId !== null ? agentInfo.statutId.libelle : 'Non spécifié',
        dateEmbauche: agentInfo?.dateEmbauche || 'Non spécifiée',
        dateNotification: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        date: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
      };

      // Utiliser la même logique de génération que generateTestPDF
      const colorPrimary = '#008751';
      const colorSecondary = '#FCD116';
      const colorDark = '#1a1a1a';

      const headerY = 30;
      const pageWidth = doc.page.width;
      const margin = 50;
      
      // Charger les logos MEF (gauche) et DNCF (droite)
      // Hauteur fixe pour les deux logos pour garantir l'alignement
      const logoHeight = 55;
      const logoXLeft = margin + 10;
      const logoY = headerY + 5; // Même position Y pour les deux logos
      
      // Chemins pour le logo MEF
      const mefLogoPaths = [
        path.join(process.cwd(), '..', 'frontend', 'public', 'mef.png'),
        path.join(process.cwd(), 'frontend', 'public', 'mef.png'),
        path.join(process.cwd(), '..', 'mef.png'),
        path.join(process.cwd(), 'mef.png'),
      ];
      
      // Chemins pour le logo DNCF
      const dncfLogoPaths = [
        path.join(process.cwd(), '..', 'frontend', 'public', 'dncf.jpg'),
        path.join(process.cwd(), 'frontend', 'public', 'dncf.jpg'),
        path.join(process.cwd(), '..', 'dncf.jpg'),
        path.join(process.cwd(), 'dncf.jpg'),
      ];

      // Charger le logo MEF à gauche avec hauteur fixe
      let mefLogoLoaded = false;
      let mefLogoWidth = logoHeight; // Par défaut, carré
      for (const logoPath of mefLogoPaths) {
        try {
          const normalizedPath = path.normalize(logoPath);
          if (fs.existsSync(normalizedPath)) {
            // Utiliser fit avec hauteur fixe, largeur proportionnelle
            doc.image(normalizedPath, logoXLeft, logoY, { 
              height: logoHeight,
              fit: [logoHeight * 2, logoHeight], // Largeur max 2x la hauteur pour préserver les proportions
            });
            mefLogoLoaded = true;
            break;
          }
        } catch (error) {
          // Continuer avec le prochain chemin
        }
      }

      // Charger le logo DNCF à droite avec la même hauteur
      let dncfLogoLoaded = false;
      let dncfLogoWidth = logoHeight; // Par défaut, carré
      for (const logoPath of dncfLogoPaths) {
        try {
          const normalizedPath = path.normalize(logoPath);
          if (fs.existsSync(normalizedPath)) {
            // Positionner à droite : calculer X en fonction de la largeur du logo
            // On utilise une largeur estimée, puis on ajuste
            const estimatedWidth = logoHeight; // Estimation initiale
            const logoXRight = pageWidth - margin - estimatedWidth - 10;
            
            // Utiliser fit avec hauteur fixe, largeur proportionnelle
            doc.image(normalizedPath, logoXRight, logoY, { 
              height: logoHeight,
              fit: [logoHeight * 2, logoHeight], // Largeur max 2x la hauteur pour préserver les proportions
            });
            dncfLogoLoaded = true;
            break;
          }
        } catch (error) {
          // Continuer avec le prochain chemin
        }
      }
      
      // Ligne de séparation verte (positionnée juste en dessous des logos)
      const separatorY = headerY + logoHeight + 15;
      doc.moveTo(margin, separatorY)
         .lineTo(pageWidth - margin, separatorY)
         .strokeColor(colorPrimary)
         .lineWidth(2)
         .stroke();

      let title = '';
      let content = '';
      switch (type) {
        case 'ORDRE_MUTATION':
          title = 'ORDRE DE MUTATION';
          content = this.getOrdreMutationContent(realData);
          break;
        case 'LETTRE_NOTIFICATION':
          title = 'LETTRE DE NOTIFICATION';
          content = this.getLettreNotificationContent(realData);
          break;
        case 'ATTESTATION_ADMINISTRATIVE':
          title = 'ATTESTATION ADMINISTRATIVE';
          content = this.getAttestationAdministrativeContent(realData);
          break;
        default:
          title = `DOCUMENT ${type}`;
          content = 'Contenu du document';
      }

      const titleY = separatorY + 20;
      doc.fillColor(colorPrimary)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(title, margin, titleY, { 
           align: 'center',
           width: pageWidth - (margin * 2)
         });

      const titleLineY = titleY + 25;
      doc.moveTo(margin + 50, titleLineY)
         .lineTo(pageWidth - margin - 50, titleLineY)
         .strokeColor(colorPrimary)
         .lineWidth(1)
         .stroke();

      let currentY = titleLineY + 20;
      const contentWidth = pageWidth - (margin * 2);
      const contentX = margin;
      
      doc.fillColor(colorDark)
         .fontSize(11)
         .font('Helvetica');
      
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          if (line.includes('N°') || line.includes('Objet :') || line.includes('Par la présente') || line.includes('Vu la')) {
            doc.font('Helvetica-Bold').fontSize(11);
          } else if (line.match(/^[A-Z\sÉÈÊÀÂÔÙÛÇ]+$/)) {
            doc.font('Helvetica-Bold').fontSize(11);
          } else {
            doc.font('Helvetica').fontSize(11);
          }
          
          const textHeight = doc.heightOfString(line.trim(), {
            width: contentWidth,
            align: 'left',
          });
          
          doc.text(line.trim(), contentX, currentY, {
            width: contentWidth,
            align: 'left',
            indent: line.startsWith('  ') ? 20 : 0,
          });
          
          currentY += textHeight + 5;
        } else {
          currentY += 10;
        }
      });

      // Ajouter signature et cachet du DNCF si disponibles
      let signatureY = currentY + 30;
      
      // Ajouter le cachet à gauche si disponible
      if (cachetBuffer) {
        try {
          const cachetSize = 50;
          const cachetX = margin + 20;
          const cachetY = signatureY;
          doc.image(cachetBuffer, cachetX, cachetY, {
            width: cachetSize,
            height: cachetSize,
            fit: [cachetSize, cachetSize],
          });
        } catch (cachetError) {
          console.warn('Erreur lors de l\'ajout du cachet:', cachetError);
        }
      }

      // Ajouter la signature à droite si disponible
      if (signatureBuffer) {
        try {
          const signatureSize = 60;
          const signatureX = pageWidth - margin - signatureSize - 20;
          const signatureYPos = signatureY;
          doc.image(signatureBuffer, signatureX, signatureYPos, {
            width: signatureSize,
            height: signatureSize * 0.5,
            fit: [signatureSize, signatureSize * 0.5],
          });
        } catch (sigError) {
          console.warn('Erreur lors de l\'ajout de la signature:', sigError);
        }
      }

      const pageHeight = doc.page.height;
      const footerY = pageHeight - 40;
      
      doc.moveTo(50, footerY - 10)
         .lineTo(pageWidth - 50, footerY - 10)
         .strokeColor('#CCCCCC')
         .lineWidth(0.5)
         .stroke();

      doc.fontSize(8)
         .fillColor('#666666')
         .font('Helvetica')
         .text(
           `Direction Nationale du Contrôle Financier - République du Bénin`,
           50,
           footerY,
           { align: 'center', width: pageWidth - 100 }
         );

      doc.fontSize(7)
         .text(
           `Document généré le ${new Date().toLocaleDateString('fr-FR', { 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric' 
           })}`,
           50,
           footerY + 12,
           { align: 'center', width: pageWidth - 100 }
         );

      doc.end();
    });
  }

  async generateTestPDF(type: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: 'Document Administratif',
          Author: 'Direction Nationale du Contrôle Financier',
          Subject: 'Document officiel',
        }
      });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
      doc.on('error', reject);

      // Données de test
      const testData = this.getTestData();

      // Couleurs officielles (vert et jaune du Bénin)
      const colorPrimary = '#008751'; // Vert du Bénin
      const colorSecondary = '#FCD116'; // Jaune du Bénin
      const colorDark = '#1a1a1a';

      // En-tête professionnel avec logos
      const headerY = 30;
      const pageWidth = doc.page.width;
      const margin = 50;
      
      // Charger les logos MEF (gauche) et DNCF (droite)
      // Hauteur fixe pour les deux logos pour garantir l'alignement
      const logoHeight = 55;
      const logoXLeft = margin + 10;
      const logoY = headerY + 5; // Même position Y pour les deux logos
      
      // Chemins pour le logo MEF
      const mefLogoPaths = [
        path.join(process.cwd(), '..', 'frontend', 'public', 'mef.png'),
        path.join(process.cwd(), 'frontend', 'public', 'mef.png'),
        path.join(process.cwd(), '..', 'mef.png'),
        path.join(process.cwd(), 'mef.png'),
      ];
      
      // Chemins pour le logo DNCF
      const dncfLogoPaths = [
        path.join(process.cwd(), '..', 'frontend', 'public', 'dncf.jpg'),
        path.join(process.cwd(), 'frontend', 'public', 'dncf.jpg'),
        path.join(process.cwd(), '..', 'dncf.jpg'),
        path.join(process.cwd(), 'dncf.jpg'),
      ];

      // Charger le logo MEF à gauche avec hauteur fixe
      let mefLogoLoaded = false;
      for (const logoPath of mefLogoPaths) {
        try {
          const normalizedPath = path.normalize(logoPath);
          if (fs.existsSync(normalizedPath)) {
            console.log('Logo MEF trouvé à:', normalizedPath);
            // Utiliser fit avec hauteur fixe, largeur proportionnelle
            doc.image(normalizedPath, logoXLeft, logoY, { 
              height: logoHeight,
              fit: [logoHeight * 2, logoHeight], // Largeur max 2x la hauteur pour préserver les proportions
            });
            mefLogoLoaded = true;
            break;
          }
        } catch (error) {
          console.log('Erreur chargement logo MEF:', error.message);
        }
      }

      // Charger le logo DNCF à droite avec la même hauteur
      let dncfLogoLoaded = false;
      for (const logoPath of dncfLogoPaths) {
        try {
          const normalizedPath = path.normalize(logoPath);
          if (fs.existsSync(normalizedPath)) {
            console.log('Logo DNCF trouvé à:', normalizedPath);
            // Positionner à droite : calculer X en fonction de la largeur estimée
            const estimatedWidth = logoHeight; // Estimation initiale
            const logoXRight = pageWidth - margin - estimatedWidth - 10;
            
            // Utiliser fit avec hauteur fixe, largeur proportionnelle
            doc.image(normalizedPath, logoXRight, logoY, { 
              height: logoHeight,
              fit: [logoHeight * 2, logoHeight], // Largeur max 2x la hauteur pour préserver les proportions
            });
            dncfLogoLoaded = true;
            break;
          }
        } catch (error) {
          console.log('Erreur chargement logo DNCF:', error.message);
        }
      }
      
      // Ligne de séparation verte (positionnée juste en dessous des logos)
      const separatorY = headerY + logoHeight + 15;
      doc.moveTo(margin, separatorY)
         .lineTo(pageWidth - margin, separatorY)
         .strokeColor(colorPrimary)
         .lineWidth(2)
         .stroke();

      // Largeur de contenu avec marges égales (définie avant utilisation)
      const contentWidth = pageWidth - (margin * 2);
      const contentX = margin;

      // Titre du document selon le type
      let title = '';
      let content = '';
      
      switch (type) {
        case 'ORDRE_MUTATION':
          title = 'ORDRE DE MUTATION';
          content = this.getOrdreMutationContent(testData);
          break;
        case 'LETTRE_NOTIFICATION':
          title = 'LETTRE DE NOTIFICATION';
          content = this.getLettreNotificationContent(testData);
          break;
        case 'ATTESTATION_ADMINISTRATIVE':
          title = 'ATTESTATION ADMINISTRATIVE';
          content = this.getAttestationAdministrativeContent(testData);
          break;
        default:
          title = `DOCUMENT ${type}`;
          content = 'Contenu du document de test';
      }

      // Titre du document avec style - positionné après l'en-tête
      const titleY = separatorY + 20;
      doc.fillColor(colorPrimary)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(title, margin, titleY, { 
           align: 'center',
           width: contentWidth
         });

      // Ligne sous le titre
      const titleLineY = titleY + 25;
      doc.moveTo(margin + 50, titleLineY)
         .lineTo(pageWidth - margin - 50, titleLineY)
         .strokeColor(colorPrimary)
         .lineWidth(1)
         .stroke();

      // Contenu du document avec mise en forme améliorée
      // Positionner après le titre et la ligne
      let currentY = titleLineY + 20;
      
      doc.fillColor(colorDark)
         .fontSize(11)
         .font('Helvetica');
      
      const lines = content.split('\n');
      lines.forEach((line) => {
        if (line.trim()) {
          // Détecter les sections importantes
          if (line.includes('N°') || line.includes('Objet :') || line.includes('Par la présente') || line.includes('Vu la')) {
            doc.font('Helvetica-Bold').fontSize(11);
          } else if (line.match(/^[A-Z\sÉÈÊÀÂÔÙÛÇ]+$/)) {
            // Titres en majuscules
            doc.font('Helvetica-Bold').fontSize(11);
          } else {
            doc.font('Helvetica').fontSize(11);
          }
          
          // Calculer la hauteur du texte pour positionner la ligne suivante
          const textHeight = doc.heightOfString(line.trim(), {
            width: contentWidth,
            align: 'left',
          });
          
          // Positionner le texte à gauche avec la marge
          doc.text(line.trim(), contentX, currentY, {
            width: contentWidth,
            align: 'left',
            indent: line.startsWith('  ') ? 20 : 0,
          });
          
          currentY += textHeight + 5; // Espacement entre les lignes
        } else {
          currentY += 10; // Espacement pour les lignes vides
        }
      });

      // Pied de page professionnel
      const pageHeight = doc.page.height;
      const footerY = pageHeight - 40;
      
      // Ligne de séparation du pied de page
      doc.moveTo(50, footerY - 10)
         .lineTo(pageWidth - 50, footerY - 10)
         .strokeColor('#CCCCCC')
         .lineWidth(0.5)
         .stroke();

      doc.fontSize(8)
         .fillColor('#666666')
         .font('Helvetica')
         .text(
           `Direction Nationale du Contrôle Financier - République du Bénin`,
           50,
           footerY,
           { align: 'center', width: pageWidth - 100 }
         );

      doc.fontSize(7)
         .text(
           `Document généré le ${new Date().toLocaleDateString('fr-FR', { 
             year: 'numeric', 
             month: 'long', 
             day: 'numeric' 
           })}`,
           50,
           footerY + 12,
           { align: 'center', width: pageWidth - 100 }
         );

      doc.end();
    });
  }

  private getTestData() {
    return {
      numero: 'ORD-MUT-2025-001',
      nomAgent: 'GBAGUIDI',
      prenomAgent: 'Jean',
      matricule: 'MEF-DNCF-2020-1234',
      grade: 'Inspecteur Principal des Finances',
      serviceActuel: 'Direction des Ressources Humaines',
      localisationActuelle: 'Cotonou',
      posteSouhaite: 'Chef de Service',
      serviceDestination: 'Direction Administrative et Financière',
      localisationDestination: 'Porto-Novo',
      dateEffet: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      dateNaissance: '15 mars 1985',
      lieuNaissance: 'Cotonou, Bénin',
      statut: 'Titulaire',
      dateEmbauche: '01 septembre 2010',
      dateNotification: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      lieu: 'Cotonou',
      date: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
    };
  }

  private getOrdreMutationContent(data: any): string {
    return `ORDRE DE MUTATION N° ${data.numero}

Le Directeur National du Contrôle Financier,

Vu la Constitution de la République du Bénin ;
Vu le décret portant organisation du Ministère de l'Économie et des Finances ;
Vu les textes réglementaires en vigueur relatifs à la gestion du personnel ;
Vu la demande de mutation de l'intéressé(e) ;

ORDONNE

La mutation de :

  Nom et Prénom : ${data.nomAgent} ${data.prenomAgent}
  Matricule : ${data.matricule}
  Grade : ${data.grade}
  Service actuel : ${data.serviceActuel}
  Localisation actuelle : ${data.localisationActuelle}

Vers :

  Poste : ${data.posteSouhaite}
  Service : ${data.serviceDestination}
  Localisation : ${data.localisationDestination}

La présente mutation prend effet à compter du ${data.dateEffet}.

Cette décision est prise en application des dispositions réglementaires en vigueur et dans l'intérêt du service.

Fait à Cotonou, le ${data.date}

Le Directeur National du Contrôle Financier

[Signature et cachet]`;
  }

  private getLettreNotificationContent(data: any): string {
    return `LETTRE DE NOTIFICATION

Référence : ${data.numero}
Objet : Notification de mutation

Madame/Monsieur ${data.nomAgent} ${data.prenomAgent},
Matricule : ${data.matricule}

Par la présente, nous avons l'honneur de vous informer que votre demande de mutation a été examinée par les instances compétentes et qu'une décision favorable a été prise à votre égard.

Conformément à l'ordre de mutation N° ${data.numero}, vous êtes affecté(e) au poste de ${data.posteSouhaite} au sein de la ${data.serviceDestination}, située à ${data.localisationDestination}.

La prise de fonction est fixée au ${data.dateEffet}.

Vous êtes prié(e) de bien vouloir :
  - Prendre contact avec votre nouveau service dans les meilleurs délais pour organiser votre prise de fonction ;
  - Procéder à la remise de service dans votre affectation actuelle ;
  - Vous conformer aux instructions qui vous seront données par votre nouveau supérieur hiérarchique.

Cette mutation est prononcée dans l'intérêt du service et en application des dispositions réglementaires en vigueur.

Nous vous prions d'agréer, Madame/Monsieur, l'expression de nos salutations distinguées.

Fait à Cotonou, le ${data.dateNotification}

Le Directeur National du Contrôle Financier

[Signature et cachet]`;
  }

  private getAttestationAdministrativeContent(data: any): string {
    return `ATTESTATION ADMINISTRATIVE

Je soussigné(e), Directeur National du Contrôle Financier, certifie que :

  Nom et Prénom : ${data.nomAgent} ${data.prenomAgent}
  Matricule : ${data.matricule}
  Date de naissance : ${data.dateNaissance}
  Lieu de naissance : ${data.lieuNaissance}
  Grade : ${data.grade}
  Statut : ${data.statut}

Est effectivement en service à la Direction Nationale du Contrôle Financier, Ministère de l'Économie et des Finances, depuis le ${data.dateEmbauche}.

L'intéressé(e) exerce actuellement les fonctions de ${data.grade} au sein de la ${data.serviceActuel}, située à ${data.localisationActuelle}.

Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.

Fait à Cotonou, le ${data.date}

Le Directeur National du Contrôle Financier

[Signature et cachet de l'administration]`;
  }
}

