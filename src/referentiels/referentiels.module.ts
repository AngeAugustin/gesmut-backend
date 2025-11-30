import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReferentielsService } from './referentiels.service';
import { ReferentielsController } from './referentiels.controller';
import { Direction, DirectionSchema } from './schemas/direction.schema';
import { Service, ServiceSchema } from './schemas/service.schema';
import { Localite, LocaliteSchema } from './schemas/localite.schema';
import { Grade, GradeSchema } from './schemas/grade.schema';
import { Statut, StatutSchema } from './schemas/statut.schema';
import { Diplome, DiplomeSchema } from './schemas/diplome.schema';
import { Competence, CompetenceSchema } from './schemas/competence.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Direction.name, schema: DirectionSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Localite.name, schema: LocaliteSchema },
      { name: Grade.name, schema: GradeSchema },
      { name: Statut.name, schema: StatutSchema },
      { name: Diplome.name, schema: DiplomeSchema },
      { name: Competence.name, schema: CompetenceSchema },
    ]),
  ],
  controllers: [ReferentielsController],
  providers: [ReferentielsService],
  exports: [ReferentielsService],
})
export class ReferentielsModule {}

