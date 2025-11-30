import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';

export type ValidationDocument = Validation & Document;

@Schema({ timestamps: true })
export class Validation {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Demande' })
  demandeId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, type: String, enum: Role })
  validateurRole: Role;

  @Prop({ required: true, type: String })
  validateurId: string;

  @Prop({ required: true })
  decision: 'VALIDE' | 'REJETE';

  @Prop({ required: true })
  commentaire: string;

  @Prop({ type: [String] })
  documentIds?: string[]; // Documents joints à la validation

  @Prop()
  dateValidation: Date;
}

export const ValidationSchema = SchemaFactory.createForClass(Validation);

