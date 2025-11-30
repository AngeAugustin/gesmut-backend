import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DemandesService } from './demandes.service';
import { DemandesController } from './demandes.controller';
import { Demande, DemandeSchema } from './schemas/demande.schema';
import { AgentsModule } from '../agents/agents.module';
import { PostesModule } from '../postes/postes.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Demande.name, schema: DemandeSchema }]),
    AgentsModule,
    PostesModule,
    WorkflowModule,
    EmailModule,
    NotificationsModule,
  ],
  controllers: [DemandesController],
  providers: [DemandesService],
  exports: [DemandesService],
})
export class DemandesModule {}

