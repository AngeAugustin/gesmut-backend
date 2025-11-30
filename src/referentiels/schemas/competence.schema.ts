import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { CompetenceCategory } from '../../common/enums/competence-category.enum';

export type CompetenceDocument = Competence & Document;

@Schema({ timestamps: true })
export class Competence {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop({ type: String, enum: CompetenceCategory })
  categorie?: CompetenceCategory;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isPredefini: boolean; // Si prédéfini ou créé par admin
}

export const CompetenceSchema = SchemaFactory.createForClass(Competence);

