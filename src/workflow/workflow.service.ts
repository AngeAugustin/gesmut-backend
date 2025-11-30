import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WorkflowConfig, WorkflowConfigDocument } from './schemas/workflow-config.schema';

@Injectable()
export class WorkflowService {
  constructor(
    @InjectModel(WorkflowConfig.name) private workflowModel: Model<WorkflowConfigDocument>,
  ) {}

  async createWorkflow(createDto: any): Promise<WorkflowConfig> {
    const workflow = new this.workflowModel(createDto);
    return workflow.save();
  }

  async getActiveWorkflow(): Promise<WorkflowConfig | null> {
    return this.workflowModel.findOne({ isActive: true }).exec();
  }

  async updateWorkflow(id: string, updateDto: any): Promise<WorkflowConfig> {
    // Désactiver tous les autres workflows si celui-ci est activé
    if (updateDto.isActive) {
      await this.workflowModel.updateMany(
        { _id: { $ne: id } },
        { isActive: false }
      );
    }
    return this.workflowModel.findByIdAndUpdate(id, updateDto, { new: true }).exec();
  }
}

