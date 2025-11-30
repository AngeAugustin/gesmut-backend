import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DocumentDocument = DocumentSchema & Document;

@Schema({ timestamps: true })
export class DocumentSchema {
  @Prop({ required: true })
  type: string; // 'DECISION', 'LETTRE', 'ARRETE', 'NOTE_SERVICE', etc.

  @Prop({ type: String })
  demandeId?: string;

  @Prop({ type: String })
  templateId?: string;

  @Prop({ required: true })
  contenu: string; // Contenu généré

  @Prop()
  signatureImageId?: string; // GridFS ID de l'image de signature

  @Prop({ type: String })
  signataireId?: string;

  @Prop()
  dateSignature?: Date;

  @Prop({ required: true })
  fichierId: string; // GridFS file ID (PDF ou Excel)

  @Prop({ required: true })
  format: 'PDF' | 'EXCEL';
}

export const DocumentSchemaSchema = SchemaFactory.createForClass(DocumentSchema);

