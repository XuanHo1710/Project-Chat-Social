import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Account, AccountSchema } from '../account/entities/account.entity';
import { Post, PostSchema } from '../post/entities/post.entity';
import { Comment, CommentSchema } from '../comment/entities/comment.entity';
import { Reaction, ReactionSchema } from '../reaction/entities/reaction.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Account.name, schema: AccountSchema },
            { name: Post.name, schema: PostSchema },
            { name: Comment.name, schema: CommentSchema },
            { name: Reaction.name, schema: ReactionSchema },
        ]),
    ],
    controllers: [AdminController],
    providers: [AdminService],
    exports: [AdminService],
})
export class AdminModule { }
