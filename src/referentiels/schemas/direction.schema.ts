import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DirectionDocument = Direction & Document;

@Schema({ timestamps: true })
export class Direction {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const DirectionSchema = SchemaFactory.createForClass(Direction);

