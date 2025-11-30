import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';

export type WorkflowConfigDocument = WorkflowConfig & Document;

@Schema({ timestamps: true })
export class EtapeWorkflow {
  @Prop({ required: true })
  ordre: number;

  @Prop({ required: true })
  nom: string;

  @Prop({ type: String, enum: Role })
  roleResponsable?: Role;

  @Prop()
  delaiJours?: number; // Délai en jours

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  retourArriereAutorise: boolean;
}

@Schema({ timestamps: true })
export class WorkflowConfig {
  @Prop({ required: true, unique: true })
  nom: string;

  @Prop()
  description?: string;

  @Prop({ type: [Object] })
  etapes: EtapeWorkflow[];

  @Prop({ default: true })
  isActive: boolean;
}

export const WorkflowConfigSchema = SchemaFactory.createForClass(WorkflowConfig);

