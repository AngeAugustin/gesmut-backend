import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { WorkflowConfig, WorkflowConfigSchema } from './schemas/workflow-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkflowConfig.name, schema: WorkflowConfigSchema },
    ]),
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}

