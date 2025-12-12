import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DemandesService } from './demandes.service';
import { DemandesController } from './demandes.controller';
import { Demande, DemandeSchema } from './schemas/demande.schema';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';
import { Poste, PosteSchema } from '../postes/schemas/poste.schema';
import { AgentsModule } from '../agents/agents.module';
import { PostesModule } from '../postes/postes.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Demande.name, schema: DemandeSchema },
      { name: Agent.name, schema: AgentSchema },
      { name: Poste.name, schema: PosteSchema },
    ]),
    AgentsModule,
    PostesModule,
    WorkflowModule,
    EmailModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [DemandesController],
  providers: [DemandesService],
  exports: [DemandesService],
})
export class DemandesModule {}

