import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { Poste, PosteDocument } from '../postes/schemas/poste.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/roles.enum';
import { PosteStatus } from '../common/enums/poste-status.enum';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    @InjectModel(Poste.name) private posteModel: Model<PosteDocument>,
    private usersService: UsersService,
  ) {}

  async create(createAgentDto: any): Promise<Agent> {
    // Supprimer responsableIds s'il est fourni (on utilise la logique automatique)
    const agentData = { ...createAgentDto };
    delete agentData.responsableIds;
    
    const agent = new this.agentModel(agentData);
    const savedAgent = await agent.save();
    
    // Synchroniser les postes avec les affectations actuelles (sans dateFin)
    if (savedAgent.affectationsPostes && savedAgent.affectationsPostes.length > 0) {
      const affectationsActuelles = savedAgent.affectationsPostes.filter((aff) => !aff.dateFin);
      
      for (const affectation of affectationsActuelles) {
        if (!affectation.posteId) continue;
        
        // Récupérer l'ID du poste
        let posteId: string;
        if (typeof affectation.posteId === 'string') {
          posteId = affectation.posteId;
        } else if (typeof affectation.posteId === 'object' && '_id' in affectation.posteId) {
          posteId = (affectation.posteId as any)._id.toString();
        } else {
          posteId = affectation.posteId.toString();
        }
        
        // Récupérer le poste
        const poste = await this.posteModel.findById(posteId);
        if (!poste) continue;
        
        const posteDoc = poste as PosteDocument;
        
        // Si le poste avait déjà un autre agent, mettre à jour l'historique de cet agent
        if (posteDoc.agentId && posteDoc.agentId.toString() !== savedAgent._id.toString()) {
          const ancienAgent = await this.agentModel.findById(posteDoc.agentId);
          if (ancienAgent && ancienAgent.affectationsPostes) {
            // Marquer la fin de l'affectation précédente pour l'ancien agent
            for (const aff of ancienAgent.affectationsPostes) {
              const affPosteId = typeof aff.posteId === 'object' && aff.posteId !== null
                ? (aff.posteId as any)._id?.toString() || (aff.posteId as any).toString()
                : aff.posteId?.toString();
              
              if (affPosteId === posteId && !aff.dateFin) {
                aff.dateFin = new Date();
                aff.motifFin = 'Mutation';
                break;
              }
            }
            await ancienAgent.save();
          }
        }
        
        // Mettre à jour le poste avec le nouvel agent
        posteDoc.agentId = savedAgent._id.toString() as any;
        posteDoc.statut = PosteStatus.OCCUPE;
        await posteDoc.save();
      }
    }
    
    // Retourner l'agent avec les données populées
    return this.findOne(savedAgent._id.toString());
  }

  async findAll(): Promise<Agent[]> {
    const agents = await this.agentModel
      .find()
      .populate('gradeId', 'libelle code description')
      .populate('statutId', 'libelle code description')
      .populate('localisationActuelleId', 'libelle code description')
      .populate({
        path: 'serviceId',
        select: 'libelle code description directionId',
        populate: {
          path: 'directionId',
          select: 'libelle code description'
        }
      })
      .populate({
        path: 'affectationsPostes.posteId',
        select: 'intitule description'
      })
      .exec();
    
    // Populate manuel des postes si nécessaire et trier les affectations
    for (const agent of agents) {
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
        
        // Trier les affectations par date de début (plus ancienne en premier)
        agent.affectationsPostes.sort((a: any, b: any) => {
          const dateA = new Date(a.dateDebut).getTime();
          const dateB = new Date(b.dateDebut).getTime();
          return dateA - dateB;
        });
      }
    }
    
    return agents;
  }

  async findOne(id: string): Promise<Agent | null> {
    const agent = await this.agentModel
      .findById(id)
      .populate('gradeId', 'libelle code description')
      .populate('statutId', 'libelle code description')
      .populate('localisationActuelleId', 'libelle code description')
      .populate({
        path: 'serviceId',
        select: 'libelle code description directionId',
        populate: {
          path: 'directionId',
          select: 'libelle code description'
        }
      })
      .populate('diplomeIds', 'libelle code description')
      .populate({
        path: 'affectationsPostes.posteId',
        select: 'intitule description'
      })
      .exec();
    
    // Populate manuel des postes si nécessaire
    if (agent && agent.affectationsPostes && agent.affectationsPostes.length > 0) {
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
      
      // Trier les affectations par date de début (plus ancienne en premier)
      agent.affectationsPostes.sort((a: any, b: any) => {
        const dateA = new Date(a.dateDebut).getTime();
        const dateB = new Date(b.dateDebut).getTime();
        return dateA - dateB;
      });
    }
    
    return agent;
  }

  async findByMatricule(matricule: string): Promise<Agent | null> {
    return this.agentModel.findOne({ matricule }).exec();
  }

  async findByNPI(npi: string): Promise<Agent | null> {
    return this.agentModel.findOne({ npi }).exec();
  }

  async findByIFU(ifu: string): Promise<Agent | null> {
    return this.agentModel.findOne({ ifu }).exec();
  }

  async findByIdentifier(type: 'matricule' | 'npi' | 'ifu', value: string): Promise<Agent | null> {
    switch (type) {
      case 'matricule':
        return this.findByMatricule(value);
      case 'npi':
        return this.findByNPI(value);
      case 'ifu':
        return this.findByIFU(value);
      default:
        return null;
    }
  }

  async update(id: string, updateAgentDto: any): Promise<Agent> {
    // Supprimer responsableIds s'il est fourni (on utilise la logique automatique)
    const updateData = { ...updateAgentDto };
    delete updateData.responsableIds;
    
    // Récupérer l'agent avant la mise à jour pour comparer les affectations
    const agentAvant = await this.agentModel.findById(id);
    const anciennesAffectationsActuelles: string[] = [];
    
    if (agentAvant && agentAvant.affectationsPostes) {
      for (const aff of agentAvant.affectationsPostes) {
        if (!aff.dateFin) {
          const posteId = typeof aff.posteId === 'string'
            ? aff.posteId
            : (typeof aff.posteId === 'object' && aff.posteId !== null && '_id' in aff.posteId
              ? (aff.posteId as any)._id.toString()
              : aff.posteId?.toString());
          if (posteId) {
            anciennesAffectationsActuelles.push(posteId);
          }
        }
      }
    }
    
    await this.agentModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    
    // Récupérer l'agent mis à jour
    const agentApres = await this.agentModel.findById(id);
    if (!agentApres) {
      return this.findOne(id);
    }
    
    // Libérer les postes qui ne sont plus affectés
    const nouvellesAffectationsActuelles: string[] = [];
    if (agentApres.affectationsPostes) {
      for (const aff of agentApres.affectationsPostes) {
        if (!aff.dateFin) {
          const posteId = typeof aff.posteId === 'string'
            ? aff.posteId
            : (typeof aff.posteId === 'object' && aff.posteId !== null && '_id' in aff.posteId
              ? (aff.posteId as any)._id.toString()
              : aff.posteId?.toString());
          if (posteId) {
            nouvellesAffectationsActuelles.push(posteId);
          }
        }
      }
    }
    
    // Libérer les postes qui ne sont plus affectés
    for (const ancienPosteId of anciennesAffectationsActuelles) {
      if (!nouvellesAffectationsActuelles.includes(ancienPosteId)) {
        const poste = await this.posteModel.findById(ancienPosteId);
        if (poste && poste.agentId?.toString() === id) {
          const posteDoc = poste as PosteDocument;
          posteDoc.agentId = undefined;
          posteDoc.statut = PosteStatus.LIBRE;
          await posteDoc.save();
        }
      }
    }
    
    // Synchroniser les nouvelles affectations actuelles (comme dans create)
    if (agentApres.affectationsPostes && agentApres.affectationsPostes.length > 0) {
      const affectationsActuelles = agentApres.affectationsPostes.filter((aff) => !aff.dateFin);
      
      for (const affectation of affectationsActuelles) {
        if (!affectation.posteId) continue;
        
        // Récupérer l'ID du poste
        let posteId: string;
        if (typeof affectation.posteId === 'string') {
          posteId = affectation.posteId;
        } else if (typeof affectation.posteId === 'object' && '_id' in affectation.posteId) {
          posteId = (affectation.posteId as any)._id.toString();
        } else {
          posteId = affectation.posteId.toString();
        }
        
        // Récupérer le poste
        const poste = await this.posteModel.findById(posteId);
        if (!poste) continue;
        
        const posteDoc = poste as PosteDocument;
        
        // Si le poste avait déjà un autre agent, mettre à jour l'historique de cet agent
        if (posteDoc.agentId && posteDoc.agentId.toString() !== agentApres._id.toString()) {
          const ancienAgent = await this.agentModel.findById(posteDoc.agentId);
          if (ancienAgent && ancienAgent.affectationsPostes) {
            // Marquer la fin de l'affectation précédente pour l'ancien agent
            for (const aff of ancienAgent.affectationsPostes) {
              const affPosteId = typeof aff.posteId === 'object' && aff.posteId !== null
                ? (aff.posteId as any)._id?.toString() || (aff.posteId as any).toString()
                : aff.posteId?.toString();
              
              if (affPosteId === posteId && !aff.dateFin) {
                aff.dateFin = new Date();
                aff.motifFin = 'Mutation';
                break;
              }
            }
            await ancienAgent.save();
          }
        }
        
        // Mettre à jour le poste avec le nouvel agent
        posteDoc.agentId = agentApres._id.toString() as any;
        posteDoc.statut = PosteStatus.OCCUPE;
        await posteDoc.save();
      }
    }
    
    // Retourner l'agent avec les données populées
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.agentModel.findByIdAndDelete(id).exec();
  }

  async calculerAnciennete(agentId: string): Promise<number> {
    const agent = await this.findOne(agentId);
    if (!agent || !agent.dateEmbauche) {
      return 0;
    }
    const diffTime = Date.now() - new Date(agent.dateEmbauche).getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365)); // Années
  }

  async findEligiblesPourMutationStrategique(criteres: any): Promise<Agent[]> {
    const query: any = {};
    if (criteres.gradeId) query.gradeId = criteres.gradeId;
    if (criteres.serviceId) query.serviceId = criteres.serviceId;
    if (criteres.localisationId) query.localisationActuelleId = criteres.localisationId;
    
    return this.agentModel.find(query)
      .populate('gradeId', 'libelle code description')
      .populate('serviceId', 'libelle code description')
      .populate('statutId', 'libelle code description')
      .populate('localisationActuelleId', 'libelle code description')
      .exec();
  }

  /**
   * Trouve automatiquement les responsables hiérarchiques d'un service
   * en cherchant les utilisateurs avec le rôle RESPONSABLE associés à ce service
   */
  private async findResponsablesByService(serviceId: string): Promise<any[]> {
    const allUsers = await this.usersService.findAll();
    return allUsers.filter((user) => {
      // Gérer les rôles multiples : vérifier si l'utilisateur a le rôle RESPONSABLE
      const userRoles = (user.roles && Array.isArray(user.roles) && user.roles.length > 0)
        ? user.roles
        : (user.role ? [user.role] : []);
      const hasResponsableRole = userRoles.includes(Role.RESPONSABLE);
      
      return hasResponsableRole &&
        user.isActive &&
        user.serviceId &&
        (user.serviceId.toString() === serviceId.toString() || user.serviceId === serviceId);
    });
  }

  /**
   * Récupère les responsables hiérarchiques d'un agent à partir de son service
   * Cette méthode remplace l'ancien champ responsableIds
   */
  async getResponsablesByAgentId(agentId: string): Promise<any[]> {
    if (!agentId) {
      return [];
    }
    const agent = await this.findOne(agentId);
    if (!agent || !agent.serviceId) {
      return [];
    }
    const agentDoc = agent as any;
    const serviceId = typeof agentDoc.serviceId === 'object' && agentDoc.serviceId !== null && '_id' in agentDoc.serviceId
      ? agentDoc.serviceId._id.toString()
      : agentDoc.serviceId.toString();
    return this.findResponsablesByService(serviceId);
  }

  /**
   * Récupère les responsables hiérarchiques directement à partir d'un serviceId
   * Utile pour les demandes publiques où on n'a pas d'agentId
   */
  async getResponsablesByServiceId(serviceId: string): Promise<any[]> {
    if (!serviceId) {
      return [];
    }
    return this.findResponsablesByService(serviceId);
  }

  /**
   * Récupère toutes les affectations de tous les agents
   * Utile pour l'admin pour voir toutes les affectations
   */
  async findAllAffectations(): Promise<any[]> {
    const agents = await this.agentModel
      .find({ 'affectationsPostes.0': { $exists: true } }) // Seulement les agents avec des affectations
      .select('matricule nom prenom affectationsPostes')
      .populate({
        path: 'affectationsPostes.posteId',
        select: 'intitule description serviceId localisationId',
        populate: [
          {
            path: 'serviceId',
            select: 'libelle code'
          },
          {
            path: 'localisationId',
            select: 'libelle code'
          }
        ]
      })
      .exec();

    const allAffectations = [];

    for (const agent of agents) {
      if (agent.affectationsPostes && agent.affectationsPostes.length > 0) {
        for (const affectation of agent.affectationsPostes) {
          const poste = affectation.posteId;
          const posteId = typeof poste === 'object' && poste !== null
            ? (poste as any)._id?.toString() || (poste as any).toString()
            : poste?.toString();

          const posteIntitule = typeof poste === 'object' && poste !== null
            ? (poste as any).intitule || 'Non spécifié'
            : 'Non spécifié';

          const servicePoste = typeof poste === 'object' && poste !== null && (poste as any).serviceId
            ? (typeof (poste as any).serviceId === 'object' && (poste as any).serviceId !== null
                ? (poste as any).serviceId.libelle || 'Non spécifié'
                : 'Non spécifié')
            : 'Non spécifié';

          const localisationPoste = typeof poste === 'object' && poste !== null && (poste as any).localisationId
            ? (typeof (poste as any).localisationId === 'object' && (poste as any).localisationId !== null
                ? (poste as any).localisationId.libelle || 'Non spécifiée'
                : 'Non spécifiée')
            : 'Non spécifiée';

          allAffectations.push({
            id: `${agent._id}_${affectation.dateDebut?.getTime() || Date.now()}`,
            agentId: agent._id.toString(),
            agentMatricule: agent.matricule,
            agentNom: agent.nom,
            agentPrenom: agent.prenom,
            agentNomComplet: `${agent.nom} ${agent.prenom}`,
            posteId: posteId,
            posteIntitule: posteIntitule,
            servicePoste: servicePoste,
            localisationPoste: localisationPoste,
            dateDebut: affectation.dateDebut,
            dateFin: affectation.dateFin || null,
            motifFin: affectation.motifFin || null,
            estActuelle: !affectation.dateFin,
          });
        }
      }
    }

    // Trier par date de début (plus récent en premier)
    allAffectations.sort((a, b) => {
      const dateA = new Date(a.dateDebut).getTime();
      const dateB = new Date(b.dateDebut).getTime();
      return dateB - dateA;
    });

    return allAffectations;
  }
}

