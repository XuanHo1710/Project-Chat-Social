import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Comment, CommentDocument } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { HashtagService } from 'src/hashtag/hashtag.service';
import { HashtagEntityType } from 'src/hashtag/entities/hashtag-mapping.entity';
import { Reaction, ReactionDocument, TypeFactor } from 'src/reaction/entities/reaction.entity';
import { ReactionService } from 'src/reaction/reaction.service';
import { NotificationEmitterService } from 'src/notification/notification-emitter.service';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationGateway } from 'src/notification/notification.gateway';
import { KafkaProducerService } from 'src/kafka/kafka-producer.service';
import { PostAccessService } from 'src/post/post-access.service';

interface CommentWithReactInfo extends Comment {
  reactInfo?: {
    isReact: boolean;
    type: string | null;
  };
}

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private cloudinaryService: CloudinaryService,
    private hashtagService: HashtagService,
    @Inject(forwardRef(() => ReactionService))
    private reactionService: ReactionService,
    private notificationEmitter: NotificationEmitterService,
    private notificationService: NotificationService,
    private notificationGateway: NotificationGateway,
    private kafkaProducer: KafkaProducerService,
    private postAccessService: PostAccessService,
  ) { }

  async create(createCommentDto: CreateCommentDto, user: any) {
    const { postId, parentId, ...rest } = createCommentDto;
    const userId = user?._id?.toString();
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid authenticated user');
    }
    await this.postAccessService.assertCanViewPost(postId, userId);

    const content = (rest.content || '').trim().slice(0, 2000);
    const media = (rest.media || []).slice(0, 4);
    if (media.length > 0) {
      await this.cloudinaryService.assertOwnedMedia(userId, media);
    }
    if (!content && media.length === 0 && !rest.image) {
      throw new BadRequestException('Comment content or media is required');
    }

    // Check if post exists
    const post = await this.postModel.findById(postId).select('userId allowComments');
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if comments are allowed
    if (post.allowComments === false) {
      throw new BadRequestException('Bình luận đã bị tắt cho bài viết này');
    }

    // If it's a reply, check parent comment exists
    let parentComment: CommentDocument | null = null;
    if (parentId) {
      parentComment = await this.commentModel.findOne({
        _id: parentId,
        postId: new Types.ObjectId(postId),
        isActive: true,
      }).select('userId');
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    // Create comment
    const comment = new this.commentModel({
      ...rest,
      content,
      media,
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
      parentId: parentId ? new Types.ObjectId(parentId) : null,
    });

    await comment.save();

    if (parentComment) {
      await this.commentModel.updateOne(
        { _id: parentComment._id, isActive: true },
        { $inc: { totalReplies: 1 } }
      );
    }

    // Process hashtags from content (if any)
    if (createCommentDto.content) {
      this.hashtagService.processHashtags(
        createCommentDto.content,
        comment._id.toString(),
        HashtagEntityType.COMMENT,
        userId
      ).catch((error) => this.logger.warn(`Failed to process comment hashtags: ${error.message}`));
    }

    // 🚀 NEW: Emit Kafka Interaction Event (For AI & Analytics)
    this.kafkaProducer.emitPostComment(
      userId,
      postId,
      comment.content
    ).catch((err) => this.logger.warn(`Kafka Comment Emit Error: ${err?.message || err}`));

    // Emit notification for post owner (if not commenting on own post)
    await this.notificationEmitter.emitPostComment(
      post.userId.toString(),
      userId,
      postId,
      user?.fullname || 'Ai đó',
      (comment.content || '').trim().slice(0, 80),
    );

    // Emit notification for parent comment owner (if replying)
    if (parentId) {
      const notificationParent = parentComment;
      if (notificationParent) {
        await this.notificationEmitter.emitCommentReply(
          notificationParent.userId.toString(),
          userId,
          postId,
          parentId,
          user?.fullname || 'Ai đó',
          (comment.content || '').trim().slice(0, 80),
        );
      }
    }
    // Increment post's comment count
    await this.postModel.findByIdAndUpdate(postId, {
      $inc: { totalComments: 1 },
    });

    // Populate user info
    await comment.populate('userId', 'firstName lastName avatar');

    // Emit to admin dashboard real-time
    const userInfo = comment.userId as any;
    this.notificationGateway.emitAdminNewComment({
      id: comment._id.toString(),
      user: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Anonymous',
      avatar: userInfo?.avatar || '',
      content: comment.content,
      time: 'Vừa xong'
    });

    return comment;
  }

  async findByPostId(
    postId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    await this.postAccessService.assertCanViewPost(postId, userId);
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    limit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 10));
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
      this.reactionService.getVisibleCommentsReactionsSummary(commentIds, userId),
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
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid comment identifier');
    }
    const parent = await this.commentModel
      .findOne({ _id: commentId, isActive: true })
      .select('postId')
      .lean();
    if (!parent) throw new NotFoundException('Comment not found');
    await this.postAccessService.assertCanViewPost(parent.postId.toString(), userId);
    page = Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1);
    limit = Math.min(100, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 5));
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
    const reactionsSummary = await this.reactionService.getVisibleCommentsReactionsSummary(
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
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid comment or user identifier');
    }
    const comment = await this.commentModel.findById(id).select('userId postId media');
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    await this.postAccessService.assertCanViewPost(comment.postId.toString(), userId);
    if (updateCommentDto.media !== undefined) {
      const existingPublicIds = new Set((comment.media || []).map((media) => media.publicId));
      const newlyAttachedMedia = updateCommentDto.media.filter(
        (media) => !media.publicId || !existingPublicIds.has(media.publicId),
      );
      await this.cloudinaryService.assertOwnedMedia(userId, newlyAttachedMedia);
    }
    const safeUpdate: Record<string, unknown> = {};
    if (updateCommentDto.content !== undefined) {
      safeUpdate.content = updateCommentDto.content.trim().slice(0, 2000);
    }
    if (updateCommentDto.image !== undefined) safeUpdate.image = updateCommentDto.image;
    if (updateCommentDto.media !== undefined) safeUpdate.media = updateCommentDto.media.slice(0, 4);
    if (Object.keys(safeUpdate).length === 0) {
      throw new BadRequestException('No supported comment fields were provided');
    }

    const updated = await this.commentModel
      .findByIdAndUpdate(
        id,
        { $set: { ...safeUpdate, isEdited: true } },
        { new: true, runValidators: true }
      )
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
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid comment or user identifier');
    }
    const comment = await this.commentModel
      .findById(id)
      .select('userId media image parentId postId');
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('You can only delete your own comments');
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
        await this.cloudinaryService.deleteOwnedMedia(userId, mediaToDelete);
      }
    }

    // Delete legacy image field if exists
    if (comment.image) {
      // Extract publicId from URL if possible
      const publicIdMatch = comment.image.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
      if (publicIdMatch) {
        await this.cloudinaryService.deleteOwnedMedia(userId, [
          { publicId: publicIdMatch[1], mediaType: 'IMAGE' },
        ]);
      }
    }

    // Delete all reactions for this comment using unified Reaction model
    await this.reactionModel.deleteMany({
      factorId: new Types.ObjectId(id),
      typeFactor: TypeFactor.COMMENT,
    });

    // Remove hashtag mappings
    await this.hashtagService.removeHashtagMappings(id, HashtagEntityType.COMMENT);

    const applyDeactivation = async (session?: ClientSession | null) => {
      const options = session ? { session } : {};

      // Deactivate all active replies of this comment
      const cascadeResult = await this.commentModel.updateMany(
        { parentId: comment._id, isActive: true },
        { $set: { isActive: false } },
        options,
      );
      const deactivatedReplies = cascadeResult.modifiedCount || 0;

      // Soft delete the target comment
      await this.commentModel.updateOne(
        { _id: comment._id },
        { $set: { isActive: false } },
        options,
      );

      // Decrement post's comment count (target + deactivated replies)
      await this.postModel.updateOne(
        { _id: comment.postId, totalComments: { $gt: 0 } },
        { $inc: { totalComments: -(1 + deactivatedReplies) } },
        options,
      );

      // If it's a reply, decrement parent's reply count
      if (comment.parentId) {
        await this.commentModel.updateOne(
          { _id: comment.parentId, totalReplies: { $gt: 0 } },
          { $inc: { totalReplies: -1 } },
          options,
        );
      }
    };

    try {
      const session = await this.commentModel.startSession();
      try {
        await session.withTransaction((txSession) => applyDeactivation(txSession));
      } finally {
        session.endSession();
      }
    } catch {
      // Transactions require a replica set; fall back to sequential best-effort.
      const stillActive = await this.commentModel.exists({ _id: comment._id, isActive: true });
      if (stillActive) {
        await applyDeactivation(null);
      }
    }

    await this.notificationService.deactivateByCommentRef(id);

    return { message: 'Comment deleted successfully' };
  }
}
