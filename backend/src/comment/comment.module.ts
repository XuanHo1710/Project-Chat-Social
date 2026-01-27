import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Comment, CommentSchema } from './entities/comment.entity';
import { Post, PostSchema } from 'src/post/entities/post.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { HashtagModule } from 'src/hashtag/hashtag.module';
import { Reaction, ReactionSchema } from 'src/reaction/entities/reaction.entity';
import { ReactionModule } from 'src/reaction/reaction.module';
import { NotificationModule } from 'src/notification/notification.module';
import { KafkaModule } from 'src/kafka/kafka.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: Post.name, schema: PostSchema },
      { name: Reaction.name, schema: ReactionSchema },
    ]),
    CloudinaryModule,
    HashtagModule,
    forwardRef(() => ReactionModule),
    NotificationModule,
    KafkaModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule { }
