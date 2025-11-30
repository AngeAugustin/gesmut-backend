import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GradeDocument = Grade & Document;

@Schema({ timestamps: true })
export class Grade {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop()
  niveau?: number; // Pour hiérarchie

  @Prop({ default: true })
  isActive: boolean;
}

export const GradeSchema = SchemaFactory.createForClass(Grade);

