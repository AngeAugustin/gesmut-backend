import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LocaliteDocument = Localite & Document;

@Schema({ timestamps: true })
export class ZoneGeographique {
  @Prop({ required: true })
  nom: string;

  @Prop({ type: [[Number]] }) // Coordonnées pour la zone sur la carte
  coordonnees: number[][];
}

@Schema({ timestamps: true })
export class Localite {
  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  libelle: string;

  @Prop()
  description?: string;

  @Prop({ type: Object })
  zoneGeographique?: ZoneGeographique;

  @Prop({ default: true })
  isActive: boolean;
}

export const LocaliteSchema = SchemaFactory.createForClass(Localite);

