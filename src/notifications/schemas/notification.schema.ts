import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, type: String })
  destinataireId: string;

  @Prop({ required: true })
  type: 'EMAIL' | 'IN_APP';

  @Prop({ required: true })
  titre: string;

  @Prop({ required: true })
  contenu: string;

  @Prop({ default: false })
  lu: boolean;

  @Prop()
  dateLecture?: Date;

  @Prop({ type: String })
  demandeId?: string; // Lien vers une demande si applicable

  @Prop()
  actionUrl?: string; // URL d'action si applicable
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

