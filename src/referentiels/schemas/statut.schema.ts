import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StatutDocument = Statut & Document;

@Schema({ timestamps: true })
export class Statut {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const StatutSchema = SchemaFactory.createForClass(Statut);

