import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { MutationType } from '../../common/enums/mutation-type.enum';
import { DemandeStatus } from '../../common/enums/demande-status.enum';

export type DemandeDocument = Demande & Document;

@Schema({ timestamps: true })
export class PieceJustificative {
  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  type: string; // MIME type

  @Prop({ required: true })
  taille: number; // En bytes

  @Prop({ required: true })
  fichierId: string; // GridFS file ID
}

@Schema({ timestamps: true })
export class Demande {
  @Prop({ type: String, enum: MutationType, required: true })
  type: MutationType;

  @Prop({ required: false, type: MongooseSchema.Types.ObjectId, ref: 'Agent' })
  agentId?: MongooseSchema.Types.ObjectId; // Optionnel pour permettre les demandes publiques

  @Prop()
  motif?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Poste' })
  posteSouhaiteId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'Localite', default: [] })
  localisationsSouhaitees?: MongooseSchema.Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Localite' })
  localisationSouhaiteId?: MongooseSchema.Types.ObjectId; // Conservé pour compatibilité ascendante

  @Prop({ type: [Object], default: [] })
  piecesJustificatives: PieceJustificative[];

  @Prop({ type: String, enum: DemandeStatus, default: DemandeStatus.BROUILLON })
  statut: DemandeStatus;

  @Prop({ type: [String] })
  validationIds: string[]; // Historique des validations

  @Prop({ type: [String] })
  documentIds: string[]; // Documents générés

  @Prop()
  priorite?: number; // Calculé automatiquement

  @Prop()
  dateSoumission?: Date;

  @Prop()
  dateExpiration?: Date; // Délai paramétrable

  @Prop()
  dateMutation?: Date; // Date à laquelle la mutation doit être appliquée automatiquement

  @Prop()
  reponseAgent?: 'ACCEPTEE' | 'RECOURS'; // Pour mutations stratégiques

  @Prop()
  commentaireAdmin?: string; // Si modification par admin

  @Prop({ type: [String] })
  raisonsIneligibilite?: string[]; // Raisons d'inéligibilité si statut = INELIGIBLE

  @Prop({ type: Object })
  informationsAgent?: {
    matricule?: string;
    nom?: string;
    prenom?: string;
    nomMariage?: string;
    adresseVille?: string;
    sexe?: string;
    email?: string; // Email pour recevoir la décision finale
    telephone?: string;
    ifu?: string; // Identifiant Fiscal Unique
    npi?: string; // Numéro Personnel d'Identification
    directionId?: string; // Direction de l'agent (pour déterminer les responsables)
    serviceId?: string; // Service de l'agent (pour déterminer les responsables)
    conjoints?: Array<{ code?: string; nom: string; prenom: string }>;
    enfants?: Array<{ code?: string; nom: string; prenom: string }>;
  };
}

export const DemandeSchema = SchemaFactory.createForClass(Demande);

