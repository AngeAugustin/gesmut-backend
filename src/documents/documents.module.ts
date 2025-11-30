import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentSchema, DocumentSchemaSchema } from './schemas/document.schema';
import { UploadModule } from '../upload/upload.module';
import { DemandesModule } from '../demandes/demandes.module';
import { UsersModule } from '../users/users.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DocumentSchema.name, schema: DocumentSchemaSchema }]),
    UploadModule,
    forwardRef(() => DemandesModule),
    UsersModule,
    AgentsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

