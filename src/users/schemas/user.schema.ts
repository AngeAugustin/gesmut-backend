import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  nom: string;

  @Prop({ required: true })
  prenom: string;

  @Prop({ type: [String], enum: Role, required: true, default: [] })
  roles: Role[];

  @Prop({ type: String, enum: Role, required: false })
  role?: Role; // Ancien champ pour compatibilité, sera supprimé après migration

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  agentId?: string; // Référence vers l'agent si l'utilisateur est un agent

  @Prop({ type: String })
  directionId?: string; // Référence vers la direction

  @Prop({ type: String })
  serviceId?: string; // Référence vers le service

  @Prop({ type: String })
  gradeId?: string; // Référence vers le grade

  @Prop({ type: String })
  posteId?: string; // Référence vers le poste

  @Prop()
  lastLogin?: Date;

  @Prop({ type: String })
  signatureImageId?: string; // GridFS ID de l'image de signature (pour DNCF)

  @Prop({ type: String })
  cachetImageId?: string; // GridFS ID de l'image du cachet (pour DNCF)
}

export const UserSchema = SchemaFactory.createForClass(User);

