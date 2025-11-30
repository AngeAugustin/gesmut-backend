import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Demande, DemandeDocument } from './schemas/demande.schema';
import { DemandeStatus } from '../common/enums/demande-status.enum';
import { MutationType } from '../common/enums/mutation-type.enum';
import { AgentsService } from '../agents/agents.service';
import { PostesService } from '../postes/postes.service';
import { WorkflowService } from '../workflow/workflow.service';
import { EmailService } from '../email/email.service';
import { ReferentielsService } from '../referentiels/referentiels.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DemandesService {
  private readonly logger = new Logger(DemandesService.name);

  constructor(
    @InjectModel(Demande.name) private demandeModel: Model<DemandeDocument>,
    private agentsService: AgentsService,
    private postesService: PostesService,
    private workflowService: WorkflowService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async createPublic(createDemandeDto: any): Promise<Demande> {
    // Créer une demande sans authentification (pour les agents publics)
    // Les informations de l'agent sont stockées dans informationsAgent
    if (createDemandeDto.type === MutationType.STRATEGIQUE) {
      throw new BadRequestException('Un agent ne peut créer que des mutations simples');
    }

    // Vérifier que les informations minimales sont présentes
    if (!createDemandeDto.informationsAgent || !createDemandeDto.informationsAgent.matricule || 
        !createDemandeDto.informationsAgent.nom || !createDemandeDto.informationsAgent.prenom) {
      throw new BadRequestException('Les informations de base de l\'agent (matricule, nom, prénom) sont obligatoires');
    }

    if (!createDemandeDto.motif || !createDemandeDto.motif.trim()) {
      throw new BadRequestException('Le motif de la demande est obligatoire');
    }

    // Vérifier que le serviceId est présent
    if (!createDemandeDto.informationsAgent?.serviceId) {
      this.logger.warn('ATTENTION: serviceId manquant dans informationsAgent lors de la création de la demande publique');
    } else {
      this.logger.log(`Demande publique créée avec serviceId: ${createDemandeDto.informationsAgent.serviceId}`);
    }

    const demande = new this.demandeModel({
      ...createDemandeDto,
      agentId: null, // Pas d'agentId car l'agent n'est pas connecté
      type: MutationType.SIMPLE,
      statut: DemandeStatus.BROUILLON,
    });
    
    // Sauvegarder d'abord pour obtenir l'ID
    const demandeDoc = await demande.save() as DemandeDocument;
    this.logger.log(`Demande sauvegardée avec informationsAgent.serviceId: ${demandeDoc.informationsAgent?.serviceId}`);
    
    // Soumettre automatiquement la demande (sans vérification d'éligibilité car pas d'agentId)
    demandeDoc.statut = DemandeStatus.EN_VALIDATION_HIERARCHIQUE;
    demandeDoc.dateSoumission = new Date();
    
    const savedDemande = await demandeDoc.save();

    // Notifier les responsables hiérarchiques
    await this.notifierResponsables(savedDemande);

    // Envoyer l'email de confirmation si l'email est fourni
    if (createDemandeDto.informationsAgent?.email) {
      try {
        // Récupérer les détails du poste et de la localisation si disponibles
        let posteSouhaite = '';
        let localisationSouhaitee = '';

        if (savedDemande.posteSouhaiteId) {
          const poste = await this.postesService.findOne(savedDemande.posteSouhaiteId.toString());
          posteSouhaite = poste?.intitule || '';
        }

        if (savedDemande.localisationSouhaiteId) {
          try {
            // Récupérer la localisation depuis le modèle directement
            const localiteModel = this.demandeModel.db.model('Localite');
            const localite = await localiteModel.findById(savedDemande.localisationSouhaiteId);
            localisationSouhaitee = localite?.libelle || savedDemande.localisationSouhaiteId.toString();
          } catch (error) {
            localisationSouhaitee = savedDemande.localisationSouhaiteId.toString();
          }
        }

        const agentName = `${createDemandeDto.informationsAgent.prenom} ${createDemandeDto.informationsAgent.nom}`;
        const dateCreation = new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await this.emailService.sendDemandeConfirmation({
          agentEmail: createDemandeDto.informationsAgent.email,
          agentName,
          demandeId: savedDemande._id.toString(),
          demandeDetails: {
            motif: savedDemande.motif,
            type: savedDemande.type,
            statut: savedDemande.statut,
            posteSouhaite,
            localisationSouhaitee,
            dateCreation,
          },
        });

        this.logger.log(`Email de confirmation envoyé à ${createDemandeDto.informationsAgent.email} pour la demande ${savedDemande._id}`);
      } catch (error) {
        // Ne pas faire échouer la création de la demande si l'email échoue
        this.logger.error(`Erreur lors de l'envoi de l'email de confirmation: ${error.message}`, error.stack);
      }
    }

    return savedDemande;
  }

  async create(createDemandeDto: any, agentId: string): Promise<Demande> {
    // Vérifier que l'agent ne crée que des mutations simples
    if (createDemandeDto.type === MutationType.STRATEGIQUE) {
      throw new BadRequestException('Un agent ne peut créer que des mutations simples');
    }

    const demande = new this.demandeModel({
      ...createDemandeDto,
      agentId,
      type: MutationType.SIMPLE,
      statut: DemandeStatus.BROUILLON,
    });
    
    const savedDemande = await demande.save();

    // Envoyer l'email de confirmation si l'agent a un email
    try {
      const agent = await this.agentsService.findOne(agentId);
      if (agent && agent.email) {
        // Récupérer les détails du poste et de la localisation si disponibles
        let posteSouhaite = '';
        let localisationSouhaitee = '';

        if (savedDemande.posteSouhaiteId) {
          const poste = await this.postesService.findOne(savedDemande.posteSouhaiteId.toString());
          posteSouhaite = poste?.intitule || '';
        }

        if (savedDemande.localisationSouhaiteId) {
          try {
            // Récupérer la localisation depuis le modèle directement
            const localiteModel = this.demandeModel.db.model('Localite');
            const localite = await localiteModel.findById(savedDemande.localisationSouhaiteId);
            localisationSouhaitee = localite?.libelle || savedDemande.localisationSouhaiteId.toString();
          } catch (error) {
            localisationSouhaitee = savedDemande.localisationSouhaiteId.toString();
          }
        }

        const agentName = `${agent.prenom} ${agent.nom}`;
        const dateCreation = new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await this.emailService.sendDemandeConfirmation({
          agentEmail: agent.email,
          agentName,
          demandeId: savedDemande._id.toString(),
          demandeDetails: {
            motif: savedDemande.motif,
            type: savedDemande.type,
            statut: savedDemande.statut,
            posteSouhaite,
            localisationSouhaitee,
            dateCreation,
          },
        });

        this.logger.log(`Email de confirmation envoyé à ${agent.email} pour la demande ${savedDemande._id}`);
      }
    } catch (error) {
      // Ne pas faire échouer la création de la demande si l'email échoue
      this.logger.error(`Erreur lors de l'envoi de l'email de confirmation pour la demande ${savedDemande._id}: ${error.message}`, error.stack);
    }

    return savedDemande;
  }

  async findAll(): Promise<Demande[]> {
    return this.demandeModel.find()
      .populate({
        path: 'agentId',
        populate: {
          path: 'serviceId',
          select: 'libelle code description directionId',
          populate: {
            path: 'directionId',
            select: 'libelle code description'
          }
        }
      })
      .populate('posteSouhaiteId localisationSouhaiteId')
      .exec();
  }

  async findByAgent(agentId: string): Promise<Demande[]> {
    return this.demandeModel.find({ agentId }).populate('posteSouhaiteId localisationSouhaiteId').exec();
  }

  /**
   * Récupère les demandes à valider pour un responsable hiérarchique
   * Filtre automatiquement par le service du responsable
   */
  async findByResponsableService(serviceId: string): Promise<Demande[]> {
    this.logger.log(`Recherche des demandes pour le service: ${serviceId}`);
    
    // Récupérer toutes les demandes avec populate
    const allDemandes = await this.findAll();
    this.logger.log(`Total de demandes récupérées: ${allDemandes.length}`);
    
    // Filtrer par service
    const demandesFiltrees = allDemandes.filter((demande) => {
      const demandeDoc = demande as any;
      // Pour les demandes avec agentId (agent connecté)
      if (demandeDoc.agentId && typeof demandeDoc.agentId === 'object' && 'serviceId' in demandeDoc.agentId) {
        const agentServiceId = typeof demandeDoc.agentId.serviceId === 'object' && demandeDoc.agentId.serviceId !== null
          ? (demandeDoc.agentId.serviceId._id?.toString() || demandeDoc.agentId.serviceId._id)
          : (demandeDoc.agentId.serviceId?.toString() || demandeDoc.agentId.serviceId);
        const match = String(agentServiceId) === String(serviceId);
        if (match) {
          this.logger.log(`Demande ${demandeDoc._id} correspond au service (via agentId)`);
        }
        return match;
      }
      // Pour les demandes publiques (informationsAgent)
      if (demandeDoc.informationsAgent?.serviceId) {
        const match = String(demandeDoc.informationsAgent.serviceId) === String(serviceId);
        if (match) {
          this.logger.log(`Demande ${demandeDoc._id} correspond au service (via informationsAgent.serviceId: ${demandeDoc.informationsAgent.serviceId})`);
        }
        return match;
      }
      return false;
    });
    
    this.logger.log(`Trouvé ${demandesFiltrees.length} demande(s) pour le service ${serviceId}`);
    return demandesFiltrees;
  }

  async findOne(id: string): Promise<Demande | null> {
    return this.demandeModel.findById(id)
      .populate({
        path: 'agentId',
        populate: {
          path: 'gradeId statutId serviceId localisationActuelleId posteActuelId',
          select: 'libelle intitule code description'
        }
      })
      .populate('posteSouhaiteId localisationSouhaiteId validationIds documentIds')
      .exec();
  }

  async update(id: string, updateDemandeDto: any): Promise<Demande> {
    const demande = await this.findOne(id);
    if (!demande) {
      throw new BadRequestException('Demande non trouvée');
    }
    if (demande.statut !== DemandeStatus.BROUILLON) {
      throw new BadRequestException('Une demande soumise ne peut plus être modifiée');
    }
    return this.demandeModel.findByIdAndUpdate(id, updateDemandeDto, { new: true }).exec();
  }

  async soumettre(id: string): Promise<Demande> {
    const demande = await this.findOne(id);
    if (!demande) {
      throw new BadRequestException('Demande non trouvée');
    }

    const demandeDoc = demande as DemandeDocument;

    // Vérifications automatiques de base
    await this.verifierEligibilite(demandeDoc);

    // Vérifier les prérequis d'éligibilité pour le poste
    if (demandeDoc.posteSouhaiteId) {
      const posteIdValue = demandeDoc.posteSouhaiteId;
      let posteId: string;
      if (typeof posteIdValue === 'object' && posteIdValue !== null) {
        posteId = (posteIdValue as any)._id?.toString() || (posteIdValue as any).toString();
      } else if (posteIdValue !== null && posteIdValue !== undefined) {
        posteId = posteIdValue.toString();
      } else {
        // Si posteIdValue est null/undefined, on ne peut pas continuer
        throw new BadRequestException('Poste souhaité invalide');
      }

      if (!demandeDoc.agentId) {
        throw new BadRequestException('Agent ID manquant dans la demande');
      }

      const agentIdValue = demandeDoc.agentId;
      let agentId: string;
      if (typeof agentIdValue === 'object' && agentIdValue !== null) {
        agentId = (agentIdValue as any)._id?.toString() || (agentIdValue as any).toString();
      } else if (agentIdValue !== null && agentIdValue !== undefined) {
        agentId = agentIdValue.toString();
      } else {
        // Si agentIdValue est null/undefined, on ne peut pas continuer
        throw new BadRequestException('Agent ID invalide');
      }

      // Vérification de l'agent effectuée, on continue avec la soumission
    }

    demandeDoc.statut = DemandeStatus.EN_VALIDATION_HIERARCHIQUE;
    demandeDoc.dateSoumission = new Date();
    const savedDemande = await demandeDoc.save();

    // Notifier les responsables hiérarchiques
    await this.notifierResponsables(savedDemande);

    return savedDemande;
  }

  /**
   * Notifie les responsables hiérarchiques lorsqu'une demande est soumise
   */
  private async notifierResponsables(demande: DemandeDocument): Promise<void> {
    try {
      let serviceId: string | null = null;

      // Déterminer le serviceId : soit depuis l'agent, soit depuis informationsAgent
      if (demande.agentId) {
        const agent = await this.agentsService.findOne(demande.agentId.toString());
        if (agent?.serviceId) {
          const agentDoc = agent as any;
          serviceId = typeof agentDoc.serviceId === 'object' && agentDoc.serviceId !== null && '_id' in agentDoc.serviceId
            ? agentDoc.serviceId._id.toString()
            : agentDoc.serviceId.toString();
        }
      } else if (demande.informationsAgent?.serviceId) {
        serviceId = demande.informationsAgent.serviceId;
      }

      if (!serviceId) {
        this.logger.warn(`Impossible de notifier les responsables : serviceId manquant pour la demande ${demande._id}`);
        return;
      }

      // Récupérer les responsables du service
      let responsables: any[] = [];
      if (demande.agentId) {
        responsables = await this.agentsService.getResponsablesByAgentId(demande.agentId.toString());
      } else if (serviceId) {
        // Pour les demandes publiques, chercher directement par serviceId
        responsables = await this.agentsService.getResponsablesByServiceId(serviceId);
      }

      // Notifier chaque responsable
      for (const responsable of responsables) {
        const responsableId = typeof responsable === 'object' && responsable !== null
          ? responsable._id?.toString() || responsable.id
          : responsable.toString();

        if (responsableId) {
          await this.notificationsService.create({
            destinataireId: responsableId,
            type: 'IN_APP',
            titre: 'Nouvelle demande de mutation',
            contenu: `Une nouvelle demande de mutation nécessite votre validation.`,
            demandeId: demande._id.toString(),
            actionUrl: '/responsable/validations',
          });
        }
      }

      this.logger.log(`Notifications envoyées à ${responsables.length} responsable(s) pour la demande ${demande._id}`);
    } catch (error) {
      // Ne pas faire échouer la soumission si la notification échoue
      this.logger.error(`Erreur lors de la notification des responsables pour la demande ${demande._id}: ${error.message}`, error.stack);
    }
  }

  async verifierEligibilite(demande: Demande | DemandeDocument): Promise<void> {
    if (!demande.agentId) {
      throw new BadRequestException('Agent ID manquant dans la demande');
    }
    
    const agentIdValue = demande.agentId!;
    let agentId: string;
    if (typeof agentIdValue === 'object' && agentIdValue !== null) {
      agentId = (agentIdValue as any)._id?.toString() || agentIdValue!.toString();
    } else {
      agentId = agentIdValue.toString();
    }
    
    const agent = await this.agentsService.findOne(agentId);
    if (!agent) {
      throw new BadRequestException('Agent non trouvé');
    }

    const agentDoc = agent as any;
    const agentIdStr = agentDoc._id?.toString() || agentId;

    // Vérifier ancienneté
    const anciennete = await this.agentsService.calculerAnciennete(agentIdStr);
    // Récupérer le seuil depuis les règles métiers (à implémenter)
    // Pour l'instant, on accepte si ancienneté > 0

    // Vérifier disponibilité du poste
    let posteSouhaiteId: string | undefined;
    if (demande.posteSouhaiteId) {
      const posteIdValue = demande.posteSouhaiteId!;
      if (typeof posteIdValue === 'object' && posteIdValue !== null) {
        posteSouhaiteId = (posteIdValue as any)._id?.toString() || posteIdValue!.toString();
      } else {
        posteSouhaiteId = posteIdValue.toString();
      }
    }

    if (posteSouhaiteId) {
      const poste = await this.postesService.findOne(posteSouhaiteId);
      if (!poste || poste.statut !== 'LIBRE') {
        throw new BadRequestException('Le poste souhaité n\'est pas disponible');
      }
    }

    // Vérifier compatibilité du grade
    if (posteSouhaiteId && agentDoc.gradeId) {
      const poste = await this.postesService.findOne(posteSouhaiteId);
      if (poste) {
        let gradeRequisId: string | undefined;
        if (poste.gradeRequisId) {
          const gradeIdValue = poste.gradeRequisId!;
          if (typeof gradeIdValue === 'object' && gradeIdValue !== null) {
            gradeRequisId = (gradeIdValue as any)._id?.toString() || gradeIdValue!.toString();
          } else {
            gradeRequisId = gradeIdValue.toString();
          }
        }
        const agentGradeId = typeof agentDoc.gradeId === 'object' && agentDoc.gradeId !== null
          ? (agentDoc.gradeId as any)._id?.toString() || agentDoc.gradeId.toString()
          : agentDoc.gradeId?.toString();
        
        if (gradeRequisId && agentGradeId && gradeRequisId !== agentGradeId) {
          throw new BadRequestException('Le grade de l\'agent n\'est pas compatible avec le poste');
        }
      }
    }
  }

  async calculerPriorite(demande: Demande | DemandeDocument): Promise<number> {
    // Logique de calcul de priorité (à affiner selon les règles métiers)
    let priorite = 0;
    if (!demande.agentId) {
      return priorite;
    }
    
    const agentIdValue = demande.agentId!;
    let agentId: string;
    if (typeof agentIdValue === 'object' && agentIdValue !== null) {
      agentId = (agentIdValue as any)._id?.toString() || agentIdValue!.toString();
    } else {
      agentId = agentIdValue.toString();
    }
    
    const agent = await this.agentsService.findOne(agentId);
    if (agent) {
      const agentDoc = agent as any;
      const agentIdStr = agentDoc._id?.toString() || agentId;
      const anciennete = await this.agentsService.calculerAnciennete(agentIdStr);
      priorite += anciennete * 10;
    }
    return priorite;
  }

  async createMutationStrategique(createDto: any): Promise<Demande> {
    const demande = new this.demandeModel({
      ...createDto,
      type: MutationType.STRATEGIQUE,
      statut: DemandeStatus.EN_ETUDE_DNCF,
    });
    return demande.save();
  }

  async remove(id: string): Promise<void> {
    await this.demandeModel.findByIdAndDelete(id).exec();
  }
}

