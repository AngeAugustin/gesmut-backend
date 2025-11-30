import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type BusinessRulesDocument = BusinessRules & Document;

@Schema({ timestamps: true })
export class BusinessRules {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  valeur: any; // Peut être string, number, object, etc.

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const BusinessRulesSchema = SchemaFactory.createForClass(BusinessRules);

