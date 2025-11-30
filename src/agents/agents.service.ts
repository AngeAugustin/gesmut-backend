import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from './schemas/agent.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../common/enums/roles.enum';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
    private usersService: UsersService,
  ) {}

  async create(createAgentDto: any): Promise<Agent> {
    // Supprimer responsableIds s'il est fourni (on utilise la logique automatique)
    const agentData = { ...createAgentDto };
    delete agentData.responsableIds;
    
    const agent = new this.agentModel(agentData);
    const savedAgent = await agent.save();
    // Retourner l'agent avec les données populées
    return this.findOne(savedAgent._id.toString());
  }

  async findAll(): Promise<Agent[]> {
    return this.agentModel
      .find()
      .populate('gradeId', 'libelle code description')
      .populate('statutId', 'libelle code description')
      .populate('posteActuelId', 'intitule description')
      .populate('localisationActuelleId', 'libelle code description')
      .populate({
        path: 'serviceId',
        select: 'libelle code description directionId',
        populate: {
          path: 'directionId',
          select: 'libelle code description'
        }
      })
      .exec();
  }

  async findOne(id: string): Promise<Agent | null> {
    return this.agentModel
      .findById(id)
      .populate('gradeId', 'libelle code description')
      .populate('statutId', 'libelle code description')
      .populate('posteActuelId', 'intitule description')
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
      .exec();
  }

  async findByMatricule(matricule: string): Promise<Agent | null> {
    return this.agentModel.findOne({ matricule }).exec();
  }

  async update(id: string, updateAgentDto: any): Promise<Agent> {
    // Supprimer responsableIds s'il est fourni (on utilise la logique automatique)
    const updateData = { ...updateAgentDto };
    delete updateData.responsableIds;
    
    await this.agentModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
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
    return allUsers.filter(
      (user) =>
        user.role === Role.RESPONSABLE &&
        user.isActive &&
        user.serviceId &&
        (user.serviceId.toString() === serviceId.toString() || user.serviceId === serviceId)
    );
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
}

