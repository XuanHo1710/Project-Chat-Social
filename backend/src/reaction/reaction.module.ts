import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { Reaction, ReactionSchema } from './entities/reaction.entity';
import { Post, PostSchema } from 'src/post/entities/post.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [ReactionController],
  providers: [ReactionService],
  exports: [ReactionService],
})
export class ReactionModule {}
