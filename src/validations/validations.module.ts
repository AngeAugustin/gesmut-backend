import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ValidationsService } from './validations.service';
import { ValidationsController } from './validations.controller';
import { Validation, ValidationSchema } from './schemas/validation.schema';
import { DemandesModule } from '../demandes/demandes.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Validation.name, schema: ValidationSchema }]),
    DemandesModule,
  ],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}

