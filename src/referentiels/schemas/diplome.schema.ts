import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DiplomeDocument = Diplome & Document;

@Schema({ timestamps: true })
export class Diplome {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop()
  niveau?: string; // 'BAC', 'LICENCE', 'MASTER', etc.

  @Prop({ default: true })
  isActive: boolean;
}

export const DiplomeSchema = SchemaFactory.createForClass(Diplome);

