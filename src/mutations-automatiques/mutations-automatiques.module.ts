import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { MutationsAutomatiquesService } from './mutations-automatiques.service';
import { Demande, DemandeSchema } from '../demandes/schemas/demande.schema';
import { PostesModule } from '../postes/postes.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{ name: Demande.name, schema: DemandeSchema }]),
    PostesModule,
    AgentsModule,
  ],
  providers: [MutationsAutomatiquesService],
  exports: [MutationsAutomatiquesService],
})
export class MutationsAutomatiquesModule {}

