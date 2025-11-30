import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: String })
  userId?: string;

  @Prop({ type: String })
  userEmail?: string;

  @Prop({ type: String })
  userRole?: string;

  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  module: string;

  @Prop({ type: String })
  method?: string; // GET, POST, PUT, PATCH, DELETE

  @Prop({ type: String })
  url?: string; // URL de la requête

  @Prop({ type: Number })
  statusCode?: number; // Code de statut HTTP

  @Prop({ type: Object })
  requestBody?: any; // Corps de la requête (pour POST, PUT, PATCH)

  @Prop({ type: Object })
  responseData?: any; // Données de la réponse

  @Prop({ type: Object })
  details?: any; // Détails supplémentaires

  @Prop({ required: true })
  ip: string; // Adresse IP (obligatoire)

  @Prop()
  userAgent?: string; // User-Agent du navigateur

  @Prop({ type: Object })
  headers?: any; // Headers de la requête (optionnel, pour debug)

  @Prop({ type: Number })
  duration?: number; // Durée de la requête en ms

  @Prop({ type: String })
  error?: string; // Message d'erreur si applicable

  @Prop({ default: Date.now })
  dateAction: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

