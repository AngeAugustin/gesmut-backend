import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostesService } from './postes.service';
import { PostesController } from './postes.controller';
import { Poste, PosteSchema } from './schemas/poste.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Poste.name, schema: PosteSchema }]),
  ],
  controllers: [PostesController],
  providers: [PostesService],
  exports: [PostesService],
})
export class PostesModule {}

