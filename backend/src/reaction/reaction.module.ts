import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { ReactionGateway } from './reaction.gateway';
import { Reaction, ReactionSchema } from './entities/reaction.entity';
import { Post, PostSchema } from 'src/post/entities/post.entity';
import { CommentModule } from 'src/comment/comment.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    CommentModule, // Import để sử dụng CommentService trong gateway
  ],
  controllers: [ReactionController],
  providers: [ReactionService, ReactionGateway],
  exports: [ReactionService],
})
export class ReactionModule { }
