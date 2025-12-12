import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Poste, PosteDocument } from './schemas/poste.schema';
import { PosteStatus } from '../common/enums/poste-status.enum';
import { Agent, AgentDocument } from '../agents/schemas/agent.schema';

@Injectable()
export class PostesService {
  constructor(
    @InjectModel(Poste.name) private posteModel: Model<PosteDocument>,
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {}

  async create(createPosteDto: any): Promise<Poste> {
    const poste = new this.posteModel(createPosteDto);
    await poste.save();
    return this.posteModel.findById(poste._id).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async findAll(): Promise<Poste[]> {
    return this.posteModel.find().populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async findOne(id: string): Promise<Poste | null> {
    return this.posteModel.findById(id).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async findByStatus(status: PosteStatus): Promise<Poste[]> {
    return this.posteModel.find({ statut: status }).populate('gradeRequisId localisationId serviceId').exec();
  }

  async findByService(serviceId: string): Promise<Poste[]> {
    return this.posteModel.find({ serviceId }).populate('gradeRequisId localisationId agentId').exec();
  }

  async update(id: string, updatePosteDto: any): Promise<Poste> {
    const poste = await this.posteModel.findById(id).exec();
    if (!poste) {
      throw new BadRequestException('Poste non trouvé');
    }
    
    // Vérifier si un agent est actuellement affecté au poste
    if (poste.agentId) {
      throw new BadRequestException('Impossible de modifier un poste avec un agent affecté. Veuillez d\'abord libérer le poste.');
    }
    
    // Vérifier si des agents ont été affectés à ce poste dans l'historique
    const agentsAvecHistorique = await this.agentModel.find({
      'affectationsPostes.posteId': id,
    }).exec();
    
    if (agentsAvecHistorique.length > 0) {
      // Vérifier s'il y a des affectations (même passées)
      // Si un agent a été affecté, même dans le passé, on ne peut plus modifier
      throw new BadRequestException('Impossible de modifier un poste qui a déjà eu des affectations. Seuls les postes sans historique peuvent être modifiés.');
    }
    
    // Mettre à jour le poste
    return this.posteModel.findByIdAndUpdate(id, updatePosteDto, { new: true }).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async remove(id: string): Promise<void> {
    const poste = await this.posteModel.findById(id).exec();
    if (!poste) {
      throw new BadRequestException('Poste non trouvé');
    }
    
    // Vérifier si un agent est actuellement affecté au poste
    if (poste.agentId) {
      throw new BadRequestException('Impossible de supprimer un poste avec un agent affecté. Veuillez d\'abord libérer le poste.');
    }
    
    // Vérifier si des agents ont été affectés à ce poste dans l'historique
    const agentsAvecHistorique = await this.agentModel.find({
      'affectationsPostes.posteId': id,
    }).exec();
    
    if (agentsAvecHistorique.length > 0) {
      // Vérifier s'il y a des affectations actuelles (sans date de fin)
      for (const agent of agentsAvecHistorique) {
        if (agent.affectationsPostes) {
          for (const affectation of agent.affectationsPostes) {
            const affectationPosteId = typeof affectation.posteId === 'object' && affectation.posteId !== null
              ? (affectation.posteId as any)._id?.toString() || (affectation.posteId as any).toString()
              : affectation.posteId?.toString();
            
            if (affectationPosteId === id && !affectation.dateFin) {
              throw new BadRequestException('Impossible de supprimer un poste avec un agent affecté. Veuillez d\'abord libérer le poste.');
            }
          }
        }
      }
    }
    
    // Supprimer le poste
    await this.posteModel.findByIdAndDelete(id).exec();
  }

  async affecterAgent(posteId: string, agentId: string): Promise<Poste> {
    const poste = await this.posteModel.findById(posteId);
    if (!poste) {
      throw new Error('Poste non trouvé');
    }
    
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new Error('Agent non trouvé');
    }
    
    // Mettre à jour le poste
    const posteDoc = poste as PosteDocument;
    const ancienAgentId = posteDoc.agentId?.toString();
    posteDoc.agentId = agentId;
    posteDoc.statut = PosteStatus.OCCUPE;
    await posteDoc.save();
    
    // Mettre à jour l'historique de l'ancien agent si nécessaire
    if (ancienAgentId && ancienAgentId !== agentId) {
      const ancienAgent = await this.agentModel.findById(ancienAgentId);
      if (ancienAgent && ancienAgent.affectationsPostes) {
        // Marquer la fin de l'affectation précédente pour l'ancien agent
        for (const affectation of ancienAgent.affectationsPostes) {
          const affectationPosteId = typeof affectation.posteId === 'object' && affectation.posteId !== null
            ? (affectation.posteId as any)._id?.toString() || (affectation.posteId as any).toString()
            : affectation.posteId?.toString();
          
          if (affectationPosteId === posteId && !affectation.dateFin) {
            affectation.dateFin = new Date();
            affectation.motifFin = 'Mutation';
            break;
          }
        }
        await ancienAgent.save();
      }
    }
    
    // Mettre à jour l'historique du nouvel agent
    const agentDoc = agent as AgentDocument;
    if (!agentDoc.affectationsPostes) {
      agentDoc.affectationsPostes = [];
    }
    
    // Vérifier si l'agent a déjà une affectation actuelle sur ce poste
    const aDejaCePoste = agentDoc.affectationsPostes.some((aff) => {
      const affectationPosteId = typeof aff.posteId === 'object' && aff.posteId !== null
        ? (aff.posteId as any)._id?.toString() || (aff.posteId as any).toString()
        : aff.posteId?.toString();
      return affectationPosteId === posteId && !aff.dateFin;
    });
    
    // Si l'agent n'a pas déjà ce poste dans son historique, l'ajouter
    if (!aDejaCePoste) {
      // Marquer la fin des autres affectations actuelles
      for (const affectation of agentDoc.affectationsPostes) {
        if (!affectation.dateFin) {
          affectation.dateFin = new Date();
          affectation.motifFin = 'Mutation';
        }
      }
      
      // Ajouter la nouvelle affectation
      agentDoc.affectationsPostes.push({
        posteId: posteId as any,
        dateDebut: new Date(),
        dateFin: undefined,
        motifFin: undefined,
      });
    }
    
    await agentDoc.save();
    
    return this.posteModel.findById(posteId).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async libererPoste(posteId: string): Promise<Poste> {
    const poste = await this.posteModel.findById(posteId);
    if (!poste) {
      throw new Error('Poste non trouvé');
    }
    
    const posteDoc = poste as PosteDocument;
    const agentId = posteDoc.agentId;
    
    // Si un agent est affecté, mettre à jour son historique
    if (agentId) {
      const agentIdStr = typeof agentId === 'object' && agentId !== null
        ? (agentId as any)._id?.toString() || (agentId as any).toString()
        : agentId.toString();
      
      const agent = await this.agentModel.findById(agentIdStr);
      if (agent && agent.affectationsPostes) {
        // Trouver l'affectation actuelle pour ce poste et la marquer comme terminée
        for (const affectation of agent.affectationsPostes) {
          const affectationPosteId = typeof affectation.posteId === 'object' && affectation.posteId !== null
            ? (affectation.posteId as any)._id?.toString() || (affectation.posteId as any).toString()
            : affectation.posteId?.toString();
          
          if (affectationPosteId === posteId && !affectation.dateFin) {
            affectation.dateFin = new Date();
            affectation.motifFin = 'Libération du poste';
            break;
          }
        }
        await agent.save();
      }
    }
    
    // Libérer le poste
    posteDoc.agentId = undefined;
    posteDoc.statut = PosteStatus.LIBRE;
    await posteDoc.save();
    
    return this.posteModel.findById(posteId).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async getHistoriqueAgents(posteId: string): Promise<any[]> {
    // Récupérer le poste pour vérifier l'agent actuel
    const poste = await this.posteModel.findById(posteId).populate('agentId').exec();
    if (!poste) {
      return [];
    }
    
    // Récupérer tous les agents qui ont été affectés à ce poste
    const agents = await this.agentModel
      .find({
        'affectationsPostes.posteId': posteId,
      })
      .select('matricule nom prenom affectationsPostes')
      .populate('gradeId')
      .exec();

    // Filtrer et formater les affectations pour ce poste spécifique
    const historique = [];
    const agentIdsDansHistorique = new Set<string>();
    
    for (const agent of agents) {
      if (agent.affectationsPostes && agent.affectationsPostes.length > 0) {
        for (const affectation of agent.affectationsPostes) {
          // Vérifier si cette affectation concerne ce poste
          const affectationPosteId = typeof affectation.posteId === 'object' && affectation.posteId !== null
            ? (affectation.posteId as any)._id?.toString() || (affectation.posteId as any).toString()
            : affectation.posteId?.toString();

          if (affectationPosteId === posteId) {
            const agentIdStr = agent._id.toString();
            agentIdsDansHistorique.add(agentIdStr);
            
            historique.push({
              agentId: agentIdStr,
              matricule: agent.matricule,
              nom: agent.nom,
              prenom: agent.prenom,
              nomComplet: `${agent.nom} ${agent.prenom}`,
              grade: agent.gradeId ? (agent.gradeId as any).libelle : '-',
              dateDebut: affectation.dateDebut,
              dateFin: affectation.dateFin || null,
              motifFin: affectation.motifFin || null,
              estActuel: !affectation.dateFin,
            });
          }
        }
      }
    }
    
    // Si le poste a un agent actuel qui n'est pas dans l'historique, l'ajouter
    if (poste.agentId) {
      const agentActuelId = typeof poste.agentId === 'object' && poste.agentId !== null
        ? (poste.agentId as any)._id?.toString() || (poste.agentId as any).toString()
        : poste.agentId?.toString();
      
      if (agentActuelId && !agentIdsDansHistorique.has(agentActuelId)) {
        // Récupérer les informations de l'agent actuel
        const agentActuel = await this.agentModel.findById(agentActuelId)
          .select('matricule nom prenom')
          .populate('gradeId')
          .exec();
        
        if (agentActuel) {
          historique.push({
            agentId: agentActuelId,
            matricule: agentActuel.matricule,
            nom: agentActuel.nom,
            prenom: agentActuel.prenom,
            nomComplet: `${agentActuel.nom} ${agentActuel.prenom}`,
            grade: agentActuel.gradeId ? (agentActuel.gradeId as any).libelle : '-',
            dateDebut: new Date(), // Date actuelle par défaut si pas dans l'historique
            dateFin: null,
            motifFin: null,
            estActuel: true,
          });
        }
      }
    }

    // Trier par date de début (plus récent en premier)
    historique.sort((a, b) => {
      const dateA = new Date(a.dateDebut).getTime();
      const dateB = new Date(b.dateDebut).getTime();
      return dateB - dateA;
    });

    return historique;
  }
}

