import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Direction, DirectionDocument } from './schemas/direction.schema';
import { Service, ServiceDocument } from './schemas/service.schema';
import { Localite, LocaliteDocument } from './schemas/localite.schema';
import { Grade, GradeDocument } from './schemas/grade.schema';
import { Statut, StatutDocument } from './schemas/statut.schema';
import { Diplome, DiplomeDocument } from './schemas/diplome.schema';
import { Competence, CompetenceDocument } from './schemas/competence.schema';

@Injectable()
export class ReferentielsService {
  constructor(
    @InjectModel(Direction.name) private directionModel: Model<DirectionDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(Localite.name) private localiteModel: Model<LocaliteDocument>,
    @InjectModel(Grade.name) private gradeModel: Model<GradeDocument>,
    @InjectModel(Statut.name) private statutModel: Model<StatutDocument>,
    @InjectModel(Diplome.name) private diplomeModel: Model<DiplomeDocument>,
    @InjectModel(Competence.name) private competenceModel: Model<CompetenceDocument>,
  ) {}

  // Directions
  async createDirection(createDto: any): Promise<Direction> {
    const direction = new this.directionModel(createDto);
    return direction.save();
  }

  async findAllDirections(): Promise<Direction[]> {
    return this.directionModel.find({ isActive: true }).exec();
  }

  async updateDirection(id: string, updateDto: any): Promise<Direction> {
    return this.directionModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteDirection(id: string): Promise<void> {
    await this.directionModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Services
  async createService(createDto: any): Promise<Service> {
    const service = new this.serviceModel(createDto);
    return service.save();
  }

  async findAllServices(): Promise<Service[]> {
    return this.serviceModel.find({ isActive: true }).populate('directionId').exec();
  }

  async findServicesByDirection(directionId: string): Promise<Service[]> {
    return this.serviceModel.find({ directionId, isActive: true }).exec();
  }

  async updateService(id: string, updateDto: any): Promise<Service> {
    return this.serviceModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteService(id: string): Promise<void> {
    await this.serviceModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Localités
  async createLocalite(createDto: any): Promise<Localite> {
    const localite = new this.localiteModel(createDto);
    return localite.save();
  }

  async findAllLocalites(): Promise<Localite[]> {
    return this.localiteModel.find({ isActive: true }).exec();
  }

  async updateLocalite(id: string, updateDto: any): Promise<Localite> {
    return this.localiteModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteLocalite(id: string): Promise<void> {
    await this.localiteModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Grades
  async createGrade(createDto: any): Promise<Grade> {
    const grade = new this.gradeModel(createDto);
    return grade.save();
  }

  async findAllGrades(): Promise<Grade[]> {
    return this.gradeModel.find({ isActive: true }).exec();
  }

  async updateGrade(id: string, updateDto: any): Promise<Grade> {
    return this.gradeModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteGrade(id: string): Promise<void> {
    await this.gradeModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Statuts
  async createStatut(createDto: any): Promise<Statut> {
    const statut = new this.statutModel(createDto);
    return statut.save();
  }

  async findAllStatuts(): Promise<Statut[]> {
    return this.statutModel.find({ isActive: true }).exec();
  }

  async updateStatut(id: string, updateDto: any): Promise<Statut> {
    return this.statutModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteStatut(id: string): Promise<void> {
    await this.statutModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Diplômes
  async createDiplome(createDto: any): Promise<Diplome> {
    const diplome = new this.diplomeModel(createDto);
    return diplome.save();
  }

  async findAllDiplomes(): Promise<Diplome[]> {
    return this.diplomeModel.find({ isActive: true }).exec();
  }

  async updateDiplome(id: string, updateDto: any): Promise<Diplome> {
    return this.diplomeModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteDiplome(id: string): Promise<void> {
    await this.diplomeModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Compétences
  async createCompetence(createDto: any): Promise<Competence> {
    const competence = new this.competenceModel(createDto);
    return competence.save();
  }

  async findAllCompetences(): Promise<Competence[]> {
    return this.competenceModel.find({ isActive: true }).exec();
  }

  async updateCompetence(id: string, updateDto: any): Promise<Competence> {
    return this.competenceModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }

  async deleteCompetence(id: string): Promise<void> {
    await this.competenceModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}

