import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { HashtagService } from 'src/hashtag/hashtag.service';
import { HashtagEntityType } from 'src/hashtag/entities/hashtag-mapping.entity';
import { Reaction, ReactionDocument, TypeFactor } from 'src/reaction/entities/reaction.entity';
import { ReactionService } from 'src/reaction/reaction.service';

interface CommentWithReactInfo extends Comment {
  reactInfo?: {
    isReact: boolean;
    type: string | null;
  };
}

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private cloudinaryService: CloudinaryService,
    private hashtagService: HashtagService,
    @Inject(forwardRef(() => ReactionService))
    private reactionService: ReactionService
  ) { }

  async create(createCommentDto: CreateCommentDto, userId: string) {
    const { postId, parentId, ...rest } = createCommentDto;

    // Check if post exists
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if comments are allowed
    if (post.allowComments === false) {
      throw new BadRequestException('Bình luận đã bị tắt cho bài viết này');
    }

    // If it's a reply, check parent comment exists
    if (parentId) {
      const parentComment = await this.commentModel.findById(parentId);
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
      // Increment parent's reply count
      await this.commentModel.findByIdAndUpdate(parentId, {
        $inc: { totalReplies: 1 },
      });
    }

    // Create comment
    const comment = new this.commentModel({
      ...rest,
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      parentId: parentId ? new Types.ObjectId(parentId) : null,
    });

    await comment.save();

    // Process hashtags from content (if any)
    if (createCommentDto.content) {
      await this.hashtagService.processHashtags(
        createCommentDto.content,
        comment._id.toString(),
        HashtagEntityType.COMMENT,
        userId
      );
    }

    // Increment post's comment count
    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { totalComments: 1 },
    });

    // Populate user info
    await comment.populate('userId', 'firstName lastName avatar');

    return comment;
  }

  async findByPostId(
    postId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    const skip = (page - 1) * limit;

    // Get top-level comments (no parent)
    const [comments, total] = await Promise.all([
      this.commentModel
        .find({ postId: new Types.ObjectId(postId), parentId: null, isActive: true })
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.commentModel.countDocuments({
        postId: new Types.ObjectId(postId),
        parentId: null,
        isActive: true,
      }),
    ]);

    // Get top reactions for comments
    const commentIdsObj = comments.map((c) => c._id);
    const commentIds = comments.map((c) => c._id.toString());

    // Get user reactions and top reactions summary in parallel
    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(commentIdsObj, userId),
      this.reactionService.getCommentsReactionsSummary(commentIds, userId),
    ]);

    // convert về map để tra O(1)
    const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

    (comments as CommentWithReactInfo[]).forEach((comment) => {
      const commentIdStr = comment._id.toString();
      const r = reactionMap.get(commentIdStr) as any;
      comment.reactInfo = {
        isReact: !!r,
        type: r ? r.type : null,
      };
    });

    // Add topReactions to each comment
    const commentsWithReactions = (comments as CommentWithReactInfo[]).map((comment) => ({
      ...comment,
      topReactions: reactionsSummary[comment._id.toString()]?.topReactions || [],
      userReaction: reactionsSummary[comment._id.toString()]?.userReaction || null,
    }));

    return {
      data: commentsWithReactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findReplies(
    commentId: string,
    userId: string,
    page: number = 1,
    limit: number = 5
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      this.commentModel
        .find({ parentId: new Types.ObjectId(commentId), isActive: true })
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.commentModel.countDocuments({
        parentId: new Types.ObjectId(commentId),
        isActive: true,
      }),
    ]);

    // Get top reactions for replies
    const replyIds = replies.map((r) => r._id.toString());
    const reactionsSummary = await this.reactionService.getCommentsReactionsSummary(
      replyIds,
      userId
    );

    // Add topReactions to each reply
    const repliesWithReactions = replies.map((reply) => ({
      ...reply,
      topReactions: reactionsSummary[reply._id.toString()]?.topReactions || [],
      userReaction: reactionsSummary[reply._id.toString()]?.userReaction || null,
    }));

    return {
      data: repliesWithReactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, updateCommentDto: UpdateCommentDto, userId: string) {
    const comment = await this.commentModel.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new BadRequestException('You can only edit your own comments');
    }

    const updated = await this.commentModel
      .findByIdAndUpdate(id, { ...updateCommentDto, isEdited: true }, { new: true })
      .populate('userId', 'firstName lastName avatar');

    // Update hashtags if content changed
    if (updateCommentDto.content !== undefined) {
      await this.hashtagService.updateHashtags(
        updateCommentDto.content || '',
        id,
        HashtagEntityType.COMMENT,
        userId
      );
    }

    return updated;
  }

  async remove(id: string, userId: string) {
    const comment = await this.commentModel.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new BadRequestException('You can only delete your own comments');
    }

    // Delete media from Cloudinary if exists
    if (comment.media && comment.media.length > 0) {
      const mediaToDelete = comment.media
        .filter((m) => m.publicId)
        .map((m) => ({
          publicId: m.publicId,
          mediaType: m.mediaType as 'IMAGE' | 'VIDEO',
        }));

      if (mediaToDelete.length > 0) {
        await this.cloudinaryService.deleteMultipleMedia(mediaToDelete);
      }
    }

    // Delete legacy image field if exists
    if (comment.image) {
      // Extract publicId from URL if possible
      const publicIdMatch = comment.image.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      if (publicIdMatch) {
        await this.cloudinaryService.deleteMedia(publicIdMatch[1], 'IMAGE');
      }
    }

    // Delete all reactions for this comment using unified Reaction model
    await this.reactionModel.deleteMany({
      factorId: new Types.ObjectId(id),
      typeFactor: TypeFactor.COMMENT,
    });

    // Remove hashtag mappings
    await this.hashtagService.removeHashtagMappings(id, HashtagEntityType.COMMENT);

    // Soft delete
    await this.commentModel.findByIdAndUpdate(id, { isActive: false });

    // Decrement post's comment count
    await this.postModel.findByIdAndUpdate(comment.postId, {
      $inc: { totalComments: -1 },
    });

    // If it's a reply, decrement parent's reply count
    if (comment.parentId) {
      await this.commentModel.findByIdAndUpdate(comment.parentId, {
        $inc: { totalReplies: -1 },
      });
    }

    return { message: 'Comment deleted successfully' };
  }
}
