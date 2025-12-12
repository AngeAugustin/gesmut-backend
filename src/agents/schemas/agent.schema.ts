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

// Sous-schéma pour les affectations de postes
const AffectationPosteSchema = new MongooseSchema({
  posteId: {
    type: MongooseSchema.Types.ObjectId,
    ref: 'Poste',
    required: true
  },
  dateDebut: {
    type: Date,
    required: true
  },
  dateFin: {
    type: Date,
    required: false
  },
  motifFin: {
    type: String,
    required: false
  }
}, { _id: false });

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

  @Prop()
  ifu?: string; // Identifiant Fiscal Unique

  @Prop()
  npi?: string; // Numéro Personnel d'Identification

  @Prop({ required: true })
  dateEmbauche: Date; // Pour calculer l'ancienneté

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Grade' })
  gradeId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Statut' })
  statutId: MongooseSchema.Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Diplome' })
  diplomeIds: MongooseSchema.Types.ObjectId[];

  @Prop({ type: [AffectationPosteSchema] })
  affectationsPostes?: Array<{
    posteId: MongooseSchema.Types.ObjectId; // Référence au poste
    dateDebut: Date; // Date de prise de service à ce poste
    dateFin?: Date; // Date de fin (null si poste actuel, sinon date de début du poste suivant ou mutation)
    motifFin?: string; // Raison de la fin (mutation, promotion, etc.)
  }>;

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

