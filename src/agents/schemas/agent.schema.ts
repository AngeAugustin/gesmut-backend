import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { CompetenceCategory } from '../../common/enums/competence-category.enum';

export type AgentDocument = Agent & Document;

@Schema({ timestamps: true })
export class Competence {
  @Prop({ required: true })
  nom: string;

  @Prop({ type: String, enum: CompetenceCategory, required: true })
  categorie: CompetenceCategory;

  @Prop()
  niveau?: string;
}

@Schema({ timestamps: true })
export class Agent {
  @Prop({ required: true, unique: true })
  matricule: string;

  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  prenom: string;

  @Prop()
  nomMariage?: string;

  @Prop()
  adresseVille?: string;

  @Prop()
  sexe?: string; // M, F, Autre

  @Prop()
  photo?: string; // URL ou ID du fichier

  @Prop({ type: [Object] })
  conjoints?: Array<{
    code?: string;
    nom: string;
    prenom: string;
  }>;

  @Prop({ type: [Object] })
  enfants?: Array<{
    code?: string;
    nom: string;
    prenom: string;
  }>;

  @Prop({ required: true })
  dateNaissance: Date;

  @Prop()
  email?: string;

  @Prop()
  telephone?: string;

  @Prop({ required: true })
  dateEmbauche: Date; // Pour calculer l'ancienneté

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Grade' })
  gradeId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Statut' })
  statutId: MongooseSchema.Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Diplome' })
  diplomeIds: MongooseSchema.Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Poste' })
  posteActuelId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Localite' })
  localisationActuelleId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Service' })
  serviceId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [Object] })
  competences: Competence[];

  @Prop({ type: [String] })
  historiqueMutations: string[]; // IDs des demandes
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

