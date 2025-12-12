import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Demande, DemandeDocument } from './schemas/demande.schema';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';
import { Poste, PosteDocument } from '../postes/schemas/poste.schema';
import { DemandeStatus } from '../common/enums/demande-status.enum';
import { MutationType } from '../common/enums/mutation-type.enum';
import { Role } from '../common/enums/roles.enum';
import { AgentsService } from '../agents/agents.service';
import { PostesService } from '../postes/postes.service';
import { WorkflowService } from '../workflow/workflow.service';
import { EmailService } from '../email/email.service';
import { ReferentielsService } from '../referentiels/referentiels.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class DemandesService {
  private readonly logger = new Logger(DemandesService.name);

  constructor(
    @InjectModel(Demande.name) private demandeModel: Model<DemandeDocument>,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(Poste.name) private posteModel: Model<PosteDocument>,
    private agentsService: AgentsService,
    private postesService: PostesService,
    private workflowService: WorkflowService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
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

    // Chercher l'agent par matricule/NPI/IFU pour récupérer son agentId
    let agentId: string | null = null;
    let roleFinal: Role | string | null = null;
    
    try {
      const matricule = createDemandeDto.informationsAgent?.matricule;
      const npi = createDemandeDto.informationsAgent?.npi;
      const ifu = createDemandeDto.informationsAgent?.ifu;
      
      let agent = null;
      if (matricule) {
        agent = await this.agentsService.findByIdentifier('matricule', matricule);
      } else if (npi) {
        agent = await this.agentsService.findByIdentifier('npi', npi);
      } else if (ifu) {
        agent = await this.agentsService.findByIdentifier('ifu', ifu);
      }
      
      if (agent) {
        const agentDoc = agent as any;
        agentId = agentDoc._id?.toString() || agentDoc.id?.toString() || null;
        this.logger.log(`🔍 [SERVICE] Agent trouvé avec ID: ${agentId}`);
        
        // Chercher l'utilisateur qui a cet agentId pour récupérer son rôle
        if (agentId) {
          const user = await this.usersService.findByAgentId(agentId);
          if (user) {
            // Gérer les rôles multiples : utiliser le premier rôle
            const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
              ? user.roles
              : (user.role ? [user.role] : []);
            roleFinal = userRoles[0];
            this.logger.log(`🔍 [SERVICE] Utilisateur trouvé avec agentId ${agentId}, rôle: ${roleFinal} (rôles disponibles: ${userRoles.join(', ')})`);
          } else {
            this.logger.warn(`⚠️ [SERVICE] Aucun utilisateur trouvé avec agentId: ${agentId}`);
          }
        }
      } else {
        this.logger.warn(`⚠️ [SERVICE] Agent non trouvé avec matricule/NPI/IFU fourni`);
      }
    } catch (error) {
      this.logger.error(`❌ [SERVICE] Erreur lors de la recherche de l'agent/utilisateur: ${error.message}`);
    }

    // Normaliser le rôle pour la comparaison
    const roleNormalise = roleFinal ? String(roleFinal).toUpperCase().trim() : null;
    this.logger.log(`🔍 [SERVICE] Demande publique - Rôle détecté: "${roleNormalise}" (agentId: ${agentId})`);

    const demande = new this.demandeModel({
      ...createDemandeDto,
      agentId: agentId || null, // Utiliser l'agentId trouvé si disponible
      type: MutationType.SIMPLE,
      statut: DemandeStatus.BROUILLON,
    });
    
    // Sauvegarder d'abord pour obtenir l'ID
    const demandeDoc = await demande.save() as DemandeDocument;
    this.logger.log(`Demande sauvegardée avec informationsAgent.serviceId: ${demandeDoc.informationsAgent?.serviceId}`);
    
    // Adapter le workflow selon le rôle de l'utilisateur
    let savedDemande: DemandeDocument;
    if (roleNormalise === Role.CVR || roleNormalise === 'CVR') {
      // Pour un utilisateur CVR, passer directement à l'étape CVR (sans Responsable ni DGR)
      this.logger.log(`✅ [SERVICE] Demande publique créée par un utilisateur CVR, workflow adapté : CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_VERIFICATION_CVR;
      demandeDoc.dateSoumission = new Date();
      savedDemande = await demandeDoc.save();
      this.logger.log(`✅ [SERVICE] Demande ${savedDemande._id} mise à jour avec statut: ${savedDemande.statut}`);
      // Ne pas notifier les responsables ni la DGR pour les demandes CVR
    } else if (roleNormalise === Role.DGR || roleNormalise === 'DGR') {
      // Pour un utilisateur DGR, passer directement à l'étape DGR (sans Responsable)
      this.logger.log(`✅ [SERVICE] Demande publique créée par un utilisateur DGR, workflow adapté : DGR → CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_ETUDE_DGR;
      demandeDoc.dateSoumission = new Date();
      savedDemande = await demandeDoc.save();
      this.logger.log(`✅ [SERVICE] Demande ${savedDemande._id} mise à jour avec statut: ${savedDemande.statut}`);
      // Ne pas notifier les responsables pour les demandes DGR
    } else {
      // Workflow normal pour les autres agents
      this.logger.log(`⚠️ [SERVICE] Demande publique créée par un agent (rôle: "${roleNormalise}"), workflow normal : Responsable → DGR → CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_VALIDATION_HIERARCHIQUE;
      demandeDoc.dateSoumission = new Date();
      savedDemande = await demandeDoc.save();

      // Notifier les responsables hiérarchiques
      await this.notifierResponsables(savedDemande);
    }

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

        // Gérer les localisations multiples (nouveau) ou unique (ancien pour compatibilité)
        const localisationsIds = savedDemande.localisationsSouhaitees || (savedDemande.localisationSouhaiteId ? [savedDemande.localisationSouhaiteId] : []);
        if (localisationsIds.length > 0) {
          try {
            const localiteModel = this.demandeModel.db.model('Localite');
            const localites = await Promise.all(
              localisationsIds.map((id) => localiteModel.findById(id))
            );
            const libelles = localites
              .filter((loc) => loc !== null)
              .map((loc) => loc.libelle)
              .filter((lib) => lib);
            localisationSouhaitee = libelles.length > 0 ? libelles.join(', ') : '';
          } catch (error) {
            localisationSouhaitee = localisationsIds.map((id) => id.toString()).join(', ');
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

  async create(createDemandeDto: any, agentId: string, demandeurRole?: Role | string): Promise<Demande> {
    // Vérifier que l'agent/DGR ne crée que des mutations simples
    if (createDemandeDto.type === MutationType.STRATEGIQUE) {
      throw new BadRequestException('Un agent ou un membre de la DGR ne peut créer que des mutations simples');
    }

    // Si le rôle n'est pas fourni, chercher l'utilisateur par agentId pour récupérer son rôle
    let roleFinal = demandeurRole;
    if (!roleFinal && agentId) {
      try {
        // Chercher l'utilisateur qui a cet agentId
        const user = await this.usersService.findByAgentId(agentId.toString());
        if (user) {
          // Gérer les rôles multiples : utiliser le premier rôle
          const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
            ? user.roles
            : (user.role ? [user.role] : []);
          roleFinal = userRoles[0];
          this.logger.log(`🔍 [SERVICE] Rôle récupéré depuis l'utilisateur (agentId: ${agentId}): ${roleFinal} (rôles disponibles: ${userRoles.join(', ')})`);
        } else {
          this.logger.warn(`⚠️ [SERVICE] Aucun utilisateur trouvé avec agentId: ${agentId}, utilisation du rôle fourni: ${demandeurRole}`);
        }
      } catch (error) {
        this.logger.error(`❌ [SERVICE] Erreur lors de la recherche de l'utilisateur par agentId: ${error.message}`);
      }
    }

    // Normaliser le rôle pour la comparaison (gérer les cas string et enum)
    const roleNormalise = roleFinal ? String(roleFinal).toUpperCase().trim() : null;
    this.logger.log(`🔍 [SERVICE] Création de demande - Rôle du demandeur: "${roleNormalise}" (original: "${demandeurRole}", final: "${roleFinal}")`);
    this.logger.log(`🔍 [SERVICE] Comparaison: roleNormalise === Role.DGR: ${roleNormalise === Role.DGR}, roleNormalise === 'DGR': ${roleNormalise === 'DGR'}`);

    const demande = new this.demandeModel({
      ...createDemandeDto,
      agentId,
      type: MutationType.SIMPLE,
      statut: DemandeStatus.BROUILLON,
    });
    
    const savedDemande = await demande.save();
    let demandeFinale = savedDemande as DemandeDocument;

    // Adapter le workflow selon le rôle du demandeur
    if (roleNormalise === Role.CVR || roleNormalise === 'CVR') {
      // Pour un utilisateur CVR, passer directement à l'étape CVR (sans Responsable ni DGR)
      this.logger.log(`✅ [SERVICE] Demande créée par un membre CVR (${savedDemande._id}), workflow adapté : CVR → DNCF`);
      demandeFinale.statut = DemandeStatus.EN_VERIFICATION_CVR;
      demandeFinale.dateSoumission = new Date();
      demandeFinale = await demandeFinale.save();
      this.logger.log(`✅ [SERVICE] Demande ${savedDemande._id} mise à jour avec statut: ${demandeFinale.statut}`);
      // Ne pas notifier les responsables ni la DGR pour les demandes CVR
    } else if (roleNormalise === Role.DGR || roleNormalise === 'DGR') {
      // Pour un utilisateur DGR, passer directement à l'étape DGR (sans Responsable)
      this.logger.log(`✅ [SERVICE] Demande créée par un membre DGR (${savedDemande._id}), workflow adapté : DGR → CVR → DNCF`);
      demandeFinale.statut = DemandeStatus.EN_ETUDE_DGR;
      demandeFinale.dateSoumission = new Date();
      demandeFinale = await demandeFinale.save();
      this.logger.log(`✅ [SERVICE] Demande ${savedDemande._id} mise à jour avec statut: ${demandeFinale.statut}`);
      // Ne pas notifier les responsables pour les demandes DGR
      // La notification sera faite directement à la DGR
    } else {
      this.logger.log(`⚠️ [SERVICE] Demande créée en BROUILLON (rôle: "${roleNormalise}"), workflow normal : Responsable → DGR → CVR → DNCF`);
    }

    // Envoyer l'email de confirmation si l'agent a un email
    try {
      const agent = await this.agentsService.findOne(agentId);
      if (agent && agent.email) {
        // Récupérer les détails du poste et de la localisation si disponibles
        let posteSouhaite = '';
        let localisationSouhaitee = '';

        if (demandeFinale.posteSouhaiteId) {
          const poste = await this.postesService.findOne(demandeFinale.posteSouhaiteId.toString());
          posteSouhaite = poste?.intitule || '';
        }

        // Gérer les localisations multiples (nouveau) ou unique (ancien pour compatibilité)
        const localisationsIds = demandeFinale.localisationsSouhaitees || (demandeFinale.localisationSouhaiteId ? [demandeFinale.localisationSouhaiteId] : []);
        if (localisationsIds.length > 0) {
          try {
            const localiteModel = this.demandeModel.db.model('Localite');
            const localites = await Promise.all(
              localisationsIds.map((id) => localiteModel.findById(id))
            );
            const libelles = localites
              .filter((loc) => loc !== null)
              .map((loc) => loc.libelle)
              .filter((lib) => lib);
            localisationSouhaitee = libelles.length > 0 ? libelles.join(', ') : '';
          } catch (error) {
            localisationSouhaitee = localisationsIds.map((id) => id.toString()).join(', ');
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
          demandeId: demandeFinale._id.toString(),
          demandeDetails: {
            motif: demandeFinale.motif,
            type: demandeFinale.type,
            statut: demandeFinale.statut,
            posteSouhaite,
            localisationSouhaitee,
            dateCreation,
          },
        });

        this.logger.log(`Email de confirmation envoyé à ${agent.email} pour la demande ${demandeFinale._id}`);
      }
    } catch (error) {
      // Ne pas faire échouer la création de la demande si l'email échoue
      this.logger.error(`Erreur lors de l'envoi de l'email de confirmation pour la demande ${demandeFinale._id}: ${error.message}`, error.stack);
    }

    return demandeFinale;
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
      .populate('posteSouhaiteId localisationsSouhaitees localisationSouhaiteId')
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
    const demande = await this.demandeModel.findById(id)
      .populate({
        path: 'agentId',
        populate: [
          {
            path: 'gradeId statutId serviceId localisationActuelleId',
            select: 'libelle intitule code description'
          },
          {
            path: 'affectationsPostes.posteId',
            select: 'intitule description'
          }
        ]
      })
      .populate({
        path: 'posteSouhaiteId',
        populate: [
          {
            path: 'serviceId',
            select: 'libelle code description'
          },
          {
            path: 'localisationId',
            select: 'libelle code description'
          }
        ]
      })
      .populate('localisationSouhaiteId validationIds documentIds')
      .exec();
    
    // Populate manuel des postes si nécessaire
    if (demande && demande.agentId && (demande.agentId as any).affectationsPostes) {
      const agent = demande.agentId as any;
      if (agent.affectationsPostes && agent.affectationsPostes.length > 0) {
        for (const affectation of agent.affectationsPostes) {
          if (!affectation.posteId) continue;
          
          // Vérifier si le poste est déjà populé avec intitule
          const isPopulated = typeof affectation.posteId === 'object' && 
                             affectation.posteId !== null && 
                             'intitule' in affectation.posteId;
          
          if (!isPopulated) {
            // Récupérer l'ID du poste
            let posteId: string;
            if (typeof affectation.posteId === 'string') {
              posteId = affectation.posteId;
            } else if (typeof affectation.posteId === 'object' && '_id' in affectation.posteId) {
              posteId = (affectation.posteId as any)._id.toString();
            } else {
              posteId = affectation.posteId.toString();
            }
            
            // Récupérer le poste depuis la base de données
            const poste = await this.posteModel.findById(posteId).select('intitule description').exec();
            if (poste) {
              affectation.posteId = poste as any;
            }
          }
        }
      }
    }
    
    return demande;
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

  async soumettre(id: string, demandeurRole?: Role | string): Promise<Demande> {
    const demande = await this.findOne(id);
    if (!demande) {
      throw new BadRequestException('Demande non trouvée');
    }

    const demandeDoc = demande as DemandeDocument;

    // Si le rôle n'est pas fourni, chercher l'utilisateur par agentId pour récupérer son rôle
    let roleFinal = demandeurRole;
    if (!roleFinal && demandeDoc.agentId) {
      try {
        const agentIdValue = demandeDoc.agentId;
        const agentId = typeof agentIdValue === 'object' && agentIdValue !== null
          ? (agentIdValue as any)._id?.toString() || agentIdValue.toString()
          : agentIdValue.toString();
        
        // Chercher l'utilisateur qui a cet agentId
        const user = await this.usersService.findByAgentId(agentId);
        if (user) {
          // Gérer les rôles multiples : utiliser le premier rôle
          const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
            ? user.roles
            : (user.role ? [user.role] : []);
          roleFinal = userRoles[0];
          this.logger.log(`🔍 [SERVICE] Rôle récupéré depuis l'utilisateur (agentId: ${agentId}): ${roleFinal} (rôles disponibles: ${userRoles.join(', ')})`);
        } else {
          this.logger.warn(`⚠️ [SERVICE] Aucun utilisateur trouvé avec agentId: ${agentId}, utilisation du rôle fourni: ${demandeurRole}`);
        }
      } catch (error) {
        this.logger.error(`❌ [SERVICE] Erreur lors de la recherche de l'utilisateur par agentId: ${error.message}`);
      }
    }

    // Normaliser le rôle pour la comparaison (gérer les cas string et enum)
    const roleNormalise = roleFinal ? String(roleFinal).toUpperCase().trim() : null;
    this.logger.log(`🔍 [SERVICE] Soumission de demande ${id} - Rôle du demandeur: "${roleNormalise}" (original: "${demandeurRole}", final: "${roleFinal}"), statut actuel: ${demandeDoc.statut}`);
    this.logger.log(`🔍 [SERVICE] Comparaison: roleNormalise === Role.DGR: ${roleNormalise === Role.DGR}, roleNormalise === 'DGR': ${roleNormalise === 'DGR'}`);

    // Si la demande est déjà dans un statut avancé (créée directement par un DGR ou CVR), ne rien faire
    if (demandeDoc.statut === DemandeStatus.EN_ETUDE_DGR || 
        demandeDoc.statut === DemandeStatus.EN_VERIFICATION_CVR) {
      this.logger.log(`✅ [SERVICE] Demande ${id} déjà dans un statut avancé (${demandeDoc.statut}), pas de modification nécessaire`);
      return demandeDoc;
    }

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
        throw new BadRequestException('Nouveau poste invalide');
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

    // Adapter le workflow selon le rôle du demandeur
    if (roleNormalise === Role.CVR || roleNormalise === 'CVR') {
      // Pour un demandeur CVR, passer directement à l'étape CVR (sans Responsable ni DGR)
      this.logger.log(`✅ [SERVICE] Soumission par un membre CVR, workflow adapté : CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_VERIFICATION_CVR;
      demandeDoc.dateSoumission = new Date();
      const savedDemande = await demandeDoc.save();
      this.logger.log(`✅ [SERVICE] Demande ${id} mise à jour avec statut: ${savedDemande.statut}`);
      // Ne pas notifier les responsables ni la DGR pour les demandes CVR
      return savedDemande;
    } else if (roleNormalise === Role.DGR || roleNormalise === 'DGR') {
      // Pour un demandeur DGR, passer directement à l'étape DGR (sans Responsable)
      this.logger.log(`✅ [SERVICE] Soumission par un membre DGR, workflow adapté : DGR → CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_ETUDE_DGR;
      demandeDoc.dateSoumission = new Date();
      const savedDemande = await demandeDoc.save();
      this.logger.log(`✅ [SERVICE] Demande ${id} mise à jour avec statut: ${savedDemande.statut}`);
      // Ne pas notifier les responsables pour les demandes DGR
      return savedDemande;
    } else {
      // Workflow normal pour les agents
      this.logger.log(`⚠️ [SERVICE] Soumission par un agent (rôle: "${roleNormalise}"), workflow normal : Responsable → DGR → CVR → DNCF`);
      demandeDoc.statut = DemandeStatus.EN_VALIDATION_HIERARCHIQUE;
      demandeDoc.dateSoumission = new Date();
      const savedDemande = await demandeDoc.save();
      this.logger.log(`⚠️ [SERVICE] Demande ${id} mise à jour avec statut: ${savedDemande.statut}`);

      // Notifier les responsables hiérarchiques
      await this.notifierResponsables(savedDemande);

      return savedDemande;
    }
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
        throw new BadRequestException('Le nouveau poste n\'est pas disponible');
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

