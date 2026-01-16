import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { Post, PostSchema } from './entities/post.entity';
import { HashtagModule } from 'src/hashtag/hashtag.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { ReactionModule } from 'src/reaction/reaction.module';
import { Reaction, ReactionSchema } from 'src/reaction/entities/reaction.entity';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ApiVideoService } from 'src/common/services/api-video.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Reaction.name, schema: ReactionSchema },
    ]),
    HashtagModule,
    CloudinaryModule,
    ReactionModule,
    HttpModule,
    ConfigModule,
  ],
  controllers: [PostController],
  providers: [PostService, ApiVideoService],
  exports: [PostService],
})
export class PostModule { }
