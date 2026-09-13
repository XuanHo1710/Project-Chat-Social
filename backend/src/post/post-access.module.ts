import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupModule } from 'src/group/group.module';
import { RelationshipModule } from 'src/relationship/relationship.module';
import { Post, PostSchema } from './entities/post.entity';
import { PostAccessService } from './post-access.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    RelationshipModule,
    GroupModule,
  ],
  providers: [PostAccessService],
  exports: [PostAccessService],
})
export class PostAccessModule {}
