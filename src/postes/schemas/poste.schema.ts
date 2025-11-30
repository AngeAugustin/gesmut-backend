import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { PosteStatus } from '../../common/enums/poste-status.enum';
import { CompetenceCategory } from '../../common/enums/competence-category.enum';

export type PosteDocument = Poste & Document;

@Schema({ timestamps: true })
export class CompetenceRequise {
  @Prop({ required: true, type: String })
  competenceId: string;

  @Prop({ type: String, enum: CompetenceCategory })
  niveauMinimum?: CompetenceCategory;
}

@Schema({ timestamps: true })
export class Poste {
  @Prop({ required: true })
  intitule: string;

  @Prop()
  description?: string;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Grade' })
  gradeRequisId: string;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Localite' })
  localisationId: string;

  @Prop({ type: String, enum: PosteStatus, default: PosteStatus.LIBRE })
  statut: PosteStatus;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Service' })
  serviceId: string;

  @Prop({ type: [Object] })
  competencesRequises: CompetenceRequise[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent' })
  agentId?: string; // Agent actuellement sur ce poste

  @Prop()
  estCritique?: boolean;

  @Prop()
  dateRenouvellement?: Date;
}

export const PosteSchema = SchemaFactory.createForClass(Poste);

