import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostesService } from './postes.service';
import { PostesController } from './postes.controller';
import { Poste, PosteSchema } from './schemas/poste.schema';
import { Agent, AgentSchema } from '../agents/schemas/agent.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Poste.name, schema: PosteSchema },
      { name: Agent.name, schema: AgentSchema },
    ]),
  ],
  controllers: [PostesController],
  providers: [PostesService],
  exports: [PostesService],
})
export class PostesModule {}

