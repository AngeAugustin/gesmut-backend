import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Validation, ValidationDocument } from './schemas/validation.schema';
import { DemandesService } from '../demandes/demandes.service';
import { DemandeStatus } from '../common/enums/demande-status.enum';
import { Role } from '../common/enums/roles.enum';
import { DemandeDocument } from '../demandes/schemas/demande.schema';
import { MutationsAutomatiquesService } from '../mutations-automatiques/mutations-automatiques.service';

@Injectable()
export class ValidationsService {
  private readonly logger = new Logger(ValidationsService.name);

  constructor(
    @InjectModel(Validation.name) private validationModel: Model<ValidationDocument>,
    private demandesService: DemandesService,
    private mutationsAutomatiquesService: MutationsAutomatiquesService,
  ) {}

  async create(createValidationDto: any): Promise<Validation> {
    const validation = new this.validationModel({
      ...createValidationDto,
      dateValidation: new Date(),
    });
    const savedValidation = await validation.save();

    // Mettre à jour le statut de la demande
    await this.updateDemandeStatus(
      createValidationDto.demandeId,
      createValidationDto.decision,
      createValidationDto.validateurRole,
      savedValidation._id.toString(),
      createValidationDto.dateMutation, // Passer la date de mutation si fournie
    );

    return savedValidation;
  }

  async updateDemandeStatus(
    demandeId: string,
    decision: string,
    role: Role,
    validationId: string,
    dateMutation?: Date,
  ): Promise<void> {
    const demande = await this.demandesService.findOne(demandeId);
    if (!demande) {
      throw new BadRequestException('Demande non trouvée');
    }

    const demandeDoc = demande as DemandeDocument;

    // Même si une étape rejette, le processus continue vers l'étape suivante
    // Les rejets sont enregistrés dans l'historique mais n'arrêtent pas le workflow
    if (decision === 'REJETE') {
      if (role === Role.RESPONSABLE) {
        // Le rejet est enregistré, mais on continue vers la DGR
        demandeDoc.statut = DemandeStatus.EN_ETUDE_DGR;
      } else if (role === Role.DGR) {
        // Le rejet est enregistré, mais on continue vers la CVR
        demandeDoc.statut = DemandeStatus.EN_VERIFICATION_CVR;
      } else if (role === Role.CVR) {
        // Le rejet est enregistré, mais on continue vers la DNCF
        demandeDoc.statut = DemandeStatus.EN_ETUDE_DNCF;
      } else if (role === Role.DNCF) {
        // Seul le DNCF peut vraiment terminer le processus avec un rejet final
        demandeDoc.statut = DemandeStatus.REJETEE;
      }
    } else if (decision === 'VALIDE') {
      if (role === Role.RESPONSABLE) {
        demandeDoc.statut = DemandeStatus.EN_ETUDE_DGR;
      } else if (role === Role.DGR) {
        demandeDoc.statut = DemandeStatus.EN_VERIFICATION_CVR;
      } else if (role === Role.CVR) {
        demandeDoc.statut = DemandeStatus.EN_ETUDE_DNCF;
      } else if (role === Role.DNCF) {
        demandeDoc.statut = DemandeStatus.ACCEPTEE;
        // Si une date de mutation est fournie, l'enregistrer
        if (dateMutation) {
          demandeDoc.dateMutation = dateMutation;
        }
      }
    }

    if (!demandeDoc.validationIds) {
      demandeDoc.validationIds = [];
    }
    demandeDoc.validationIds.push(validationId);
    await demandeDoc.save();

    // Si la demande est acceptée par le DNCF et qu'aucune date de mutation n'est fournie,
    // appliquer la mutation immédiatement
    if (decision === 'VALIDE' && role === Role.DNCF && !dateMutation) {
      // Vérifier que la demande a un poste et un agent pour appliquer la mutation
      if (demandeDoc.posteSouhaiteId && demandeDoc.agentId) {
        try {
          this.logger.log(`Application immédiate de la mutation pour la demande ${demandeId}`);
          await this.mutationsAutomatiquesService.appliquerMutationManuelle(demandeId);
          this.logger.log(`Mutation appliquée immédiatement pour la demande ${demandeId}`);
        } catch (error) {
          this.logger.error(
            `Erreur lors de l'application immédiate de la mutation pour la demande ${demandeId}: ${error.message}`,
            error.stack
          );
          // Ne pas faire échouer la validation si l'application de la mutation échoue
          // La mutation pourra être appliquée plus tard via la tâche cron
        }
      }
    }
  }

  async findByDemande(demandeId: string): Promise<Validation[]> {
    return this.validationModel
      .find({ demandeId })
      .populate({
        path: 'demandeId',
        populate: {
          path: 'agentId',
          select: 'nom prenom matricule',
        },
      })
      .populate('validateurId')
      .exec();
  }

  async findOne(id: string): Promise<Validation | null> {
    return this.validationModel
      .findById(id)
      .populate({
        path: 'demandeId',
        populate: {
          path: 'agentId',
          select: 'nom prenom matricule',
        },
      })
      .populate('validateurId')
      .exec();
  }

  async findAll(): Promise<Validation[]> {
    return this.validationModel
      .find()
      .populate({
        path: 'demandeId',
        populate: {
          path: 'agentId',
          select: 'nom prenom matricule',
        },
      })
      .populate('validateurId')
      .exec();
  }
}

