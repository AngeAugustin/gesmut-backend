import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ValidationsService } from './validations.service';
import { ValidationsController } from './validations.controller';
import { Validation, ValidationSchema } from './schemas/validation.schema';
import { DemandesModule } from '../demandes/demandes.module';
import { MutationsAutomatiquesModule } from '../mutations-automatiques/mutations-automatiques.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Validation.name, schema: ValidationSchema }]),
    DemandesModule,
    MutationsAutomatiquesModule,
  ],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}

