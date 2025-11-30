import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type PrerequisEligibiliteDocument = PrerequisEligibilite & Document;

@Schema({ timestamps: true })
export class ReglePrerequis {
  @Prop({ required: true })
  code: string; // Code de la règle (ex: SEUIL_ANCIENNETE, GRADE_REQUIS, etc.)

  @Prop({ required: true })
  libelle: string; // Libellé de la règle

  @Prop({ required: true, type: MongooseSchema.Types.Mixed })
  valeur: any; // Valeur de la règle (peut être string, number, object, etc.)

  @Prop()
  description?: string; // Description de la règle

  @Prop({ default: true })
  isActive: boolean; // Si la règle est active dans ce prérequis
}

@Schema({ timestamps: true })
export class PrerequisEligibilite {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Poste' })
  posteId: string; // Poste auquel ce prérequis est lié

  @Prop({ required: true })
  libelle: string; // Libellé du prérequis (ex: "Prérequis pour Directeur")

  @Prop()
  description?: string; // Description du prérequis

  @Prop({ type: [Object], default: [] })
  regles: ReglePrerequis[]; // Ensemble de règles métier

  @Prop({ default: true })
  isActive: boolean; // Si le prérequis est actif
}

export const PrerequisEligibiliteSchema = SchemaFactory.createForClass(PrerequisEligibilite);

