import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Poste, PosteDocument } from './schemas/poste.schema';
import { PosteStatus } from '../common/enums/poste-status.enum';
import { AgentDocument } from '../agents/schemas/agent.schema';

@Injectable()
export class PostesService {
  constructor(
    @InjectModel(Poste.name) private posteModel: Model<PosteDocument>,
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
    return this.posteModel.findByIdAndUpdate(id, updatePosteDto, { new: true }).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async remove(id: string): Promise<void> {
    await this.posteModel.findByIdAndDelete(id).exec();
  }

  async affecterAgent(posteId: string, agentId: string): Promise<Poste> {
    const poste = await this.posteModel.findById(posteId);
    if (!poste) {
      throw new Error('Poste non trouvé');
    }
    const posteDoc = poste as PosteDocument;
    posteDoc.agentId = agentId;
    posteDoc.statut = PosteStatus.OCCUPE;
    await posteDoc.save();
    return this.posteModel.findById(posteId).populate('gradeRequisId localisationId serviceId agentId').exec();
  }

  async libererPoste(posteId: string): Promise<Poste> {
    const poste = await this.posteModel.findById(posteId);
    if (!poste) {
      throw new Error('Poste non trouvé');
    }
    const posteDoc = poste as PosteDocument;
    posteDoc.agentId = undefined;
    posteDoc.statut = PosteStatus.LIBRE;
    await posteDoc.save();
    return this.posteModel.findById(posteId).populate('gradeRequisId localisationId serviceId agentId').exec();
  }
}

