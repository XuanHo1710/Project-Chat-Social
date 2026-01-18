import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReactionService } from './reaction.service';
import { ReactionController } from './reaction.controller';
import { ReactionGateway } from './reaction.gateway';
import { Reaction, ReactionSchema } from './entities/reaction.entity';
import { Post, PostSchema } from 'src/post/entities/post.entity';
import { Comment, CommentSchema } from 'src/comment/entities/comment.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { AccountModule } from 'src/account/account.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Reaction.name, schema: ReactionSchema },
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    NotificationModule,
    AccountModule,
  ],
  controllers: [ReactionController],
  providers: [ReactionService, ReactionGateway],
  exports: [ReactionService],
})
export class ReactionModule {}
