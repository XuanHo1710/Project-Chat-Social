import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { Comment, CommentSchema } from './entities/comment.entity';
import { CommentReaction, CommentReactionSchema } from './entities/comment-reaction.entity';
import { Post, PostSchema } from 'src/post/entities/post.entity';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { HashtagModule } from 'src/hashtag/hashtag.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Comment.name, schema: CommentSchema },
      { name: CommentReaction.name, schema: CommentReactionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
    CloudinaryModule,
    HashtagModule,
  ],
  controllers: [CommentController],
  providers: [CommentService],
  exports: [CommentService],
})
export class CommentModule { }
