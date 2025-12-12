import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgentsModule } from './agents/agents.module';
import { DemandesModule } from './demandes/demandes.module';
import { PostesModule } from './postes/postes.module';
import { ValidationsModule } from './validations/validations.module';
import { DocumentsModule } from './documents/documents.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReferentielsModule } from './referentiels/referentiels.module';
import { WorkflowModule } from './workflow/workflow.module';
import { AuditModule } from './audit/audit.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';
import { MutationsAutomatiquesModule } from './mutations-automatiques/mutations-automatiques.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gesmut'),
    AuthModule,
    UsersModule,
    AgentsModule,
    DemandesModule,
    PostesModule,
    ValidationsModule,
    DocumentsModule,
    NotificationsModule,
    ReferentielsModule,
    WorkflowModule,
    AuditModule,
    UploadModule,
    EmailModule,
    MutationsAutomatiquesModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}

