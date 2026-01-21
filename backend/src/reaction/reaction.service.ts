import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, Types } from 'mongoose';
import { Reaction, ReactionDocument, ReactionType, TypeFactor } from './entities/reaction.entity';
import {
  CreateReactionDto,
  CreatePostReactionDto,
  CreateCommentReactionDto,
} from './dto/create-reaction.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';
import { Comment, CommentDocument } from 'src/comment/entities/comment.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';

@Injectable()
export class ReactionService implements OnModuleInit {
  private readonly logger = new Logger(ReactionService.name);

  constructor(
    @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private readonly notificationService: NotificationService
  ) { }

  async onModuleInit() {
    // Auto-run migration on startup
    this.logger.log('Checking reactions schema and indexes...');
    await this.ensureIndexes();
  }

  private async ensureIndexes() {
    try {
      // Drop old index if exists
      try {
        await this.reactionModel.collection.dropIndex('postId_1_userId_1');
        this.logger.log('Dropped old index: postId_1_userId_1');
      } catch (e: any) {
        // Index doesn't exist, that's ok
      }

      // Ensure new index exists
      const indexes = await this.reactionModel.collection.indexes();
      const hasNewIndex = indexes.some(
        (idx: any) => idx.key?.factorId && idx.key?.typeFactor && idx.key?.userId
      );

      if (!hasNewIndex) {
        await this.reactionModel.collection.createIndex(
          { factorId: 1, typeFactor: 1, userId: 1 },
          { unique: true }
        );
        this.logger.log('Created new index: factorId_1_typeFactor_1_userId_1');
      }
    } catch (e: any) {
      this.logger.error('Error ensuring indexes:', e.message);
    }
  }

  async userReactions(factorIds: ObjectId[], currentUserId: string): Promise<any> {
    return await this.reactionModel
      .find({
        factorId: { $in: factorIds },
        userId: currentUserId,
      })
      .lean();
  }

  /**
   * Toggle reaction on any factor (post/comment/message)
   * - If user hasn't reacted: add reaction
   * - If user reacted with same type: remove reaction
   * - If user reacted with different type: update reaction
   */

  formatReactionTypeToVietnamese(type: ReactionType): string {
    switch (type) {
      case ReactionType.LIKE:
        return 'Thích';
      case ReactionType.LOVE:
        return 'Yêu thích';
      case ReactionType.HAHA:
        return 'Haha';
      case ReactionType.WOW:
        return 'Wow';
      case ReactionType.SAD:
        return 'Buồn';
      case ReactionType.ANGRY:
        return 'Phẫn nộ';
      default:
        return 'Thích';
    }
  }

  formatReactionTypeToView(type: ReactionType): string {
    switch (type) {
      case ReactionType.LIKE:
        return '👍';
      case ReactionType.LOVE:
        return '❤️';
      case ReactionType.HAHA:
        return '😂';
      case ReactionType.WOW:
        return '😮';
      case ReactionType.SAD:
        return '😢';
      case ReactionType.ANGRY:
        return '😠';
      default:
        return '👍';
    }
  }

  async toggleReaction(createReactionDto: CreateReactionDto, user: any) {
    const { factorId, typeFactor, type } = createReactionDto;

    // Validate the factor exists
    await this.validateFactor(factorId, typeFactor);

    // Find existing reaction
    const existingReaction = await this.reactionModel.findOne({
      factorId: new Types.ObjectId(factorId),
      typeFactor,
      userId: new Types.ObjectId(user._id),
    });

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction type - remove it
        await this.reactionModel.findByIdAndDelete(existingReaction._id);
        const totalReacts = await this.updateFactorReactCount(factorId, typeFactor, -1);
        return {
          action: 'removed',
          reaction: null,
          totalReacts: Math.max(0, totalReacts),
        };
      } else {
        // Different reaction type - update it
        await this.reactionModel.updateOne({ _id: existingReaction._id }, { type });
        const currentTotal = await this.getFactorReactCount(factorId, typeFactor);
        await this.sendNotificationForReaction(factorId, typeFactor, type, user);
        return {
          action: 'updated',
          reaction: { ...existingReaction.toObject(), type },
          totalReacts: currentTotal,
        };
      }
    } else {
      // No existing reaction - create new one
      try {
        const reaction = new this.reactionModel({
          factorId: new Types.ObjectId(factorId),
          typeFactor,
          userId: new Types.ObjectId(user._id),
          type,
        });
        await reaction.save();
        const totalReacts = await this.updateFactorReactCount(factorId, typeFactor, 1);
        await this.sendNotificationForReaction(factorId, typeFactor, type, user);
        return {
          action: 'added',
          reaction,
          totalReacts,
        };
      } catch (error: any) {
        // Handle duplicate key error (race condition)
        if (error.code === 11000) {
          const currentReaction = await this.reactionModel.findOne({
            factorId: new Types.ObjectId(factorId),
            typeFactor,
            userId: new Types.ObjectId(user._id),
          });
          const currentTotal = await this.getFactorReactCount(factorId, typeFactor);

          if (currentReaction && currentReaction.type !== type) {
            await this.reactionModel.updateOne({ _id: currentReaction._id }, { type });
            return {
              action: 'updated',
              reaction: { ...currentReaction.toObject(), type },
              totalReacts: currentTotal,
            };
          }
          return {
            action: 'exists',
            reaction: currentReaction,
            totalReacts: currentTotal,
          };
        }
        throw error;
      }
    }
  }

  /**
   * Legacy method for post reactions (backward compatibility)
   */
  async togglePostReaction(dto: CreatePostReactionDto, user: any) {
    return this.toggleReaction(
      {
        factorId: dto.postId,
        typeFactor: TypeFactor.POST,
        type: dto.type,
      },
      user
    );
  }

  /**
   * Legacy method for comment reactions (backward compatibility)
   */
  async toggleCommentReaction(dto: CreateCommentReactionDto, user: any) {
    return this.toggleReaction(
      {
        factorId: dto.commentId,
        typeFactor: TypeFactor.COMMENT,
        type: dto.type,
      },
      user
    );
  }

  private async sendNotificationForReaction(
    factorId: string,
    typeFactor: TypeFactor,
    type: ReactionType,
    user: any
  ): Promise<void> {
    // Implementation for sending notifications
    const id = new Types.ObjectId(factorId);
    switch (typeFactor) {
      case TypeFactor.POST:
        const post = await this.postModel.findById(id);
        if (!post) throw new NotFoundException('Post not found');
        // Check if reactions are allowed
        if (post.allowReactions === false) {
          throw new BadRequestException('Tương tác đã bị tắt cho bài viết này');
        }

        console.log(post.userId)
        console.log(user._id)

        if (post.userId.toString() !== user._id.toString()) {
          this.notificationService.create({
            recipientId: post.userId.toString(),
            senderId: user._id,
            type: NotificationType.POST_REACTED,
            title: 'Reaction post',
            message: `${user?.firstName + ' ' + user?.lastName || 'Someone'} đã thả cảm xúc "${this.formatReactionTypeToVietnamese(type)}" về bài viết của bạn`,
            postId: post._id.toString(),
            typeReaction: this.formatReactionTypeToView(type),
          });
        }

        break;
      case TypeFactor.COMMENT:
        const comment = await this.commentModel.findById(id);
        if (!comment) throw new NotFoundException('Comment not found');

        if (comment.userId.toString() !== user._id.toString()) {
          this.notificationService.create({
            recipientId: comment.userId.toString(),
            senderId: user._id,
            type: NotificationType.COMMENT_REACTED,
            title: 'Reaction comment',
            message: `${user?.firstName + ' ' + user?.lastName || 'Someone'} đã thả cảm xúc "${this.formatReactionTypeToVietnamese(type)}" về bình luận của bạn`,
            commentId: comment._id.toString(),
            postId: comment.postId.toString(),
            typeReaction: this.formatReactionTypeToView(type),
          });
        }
        break;
      case TypeFactor.MESSAGE:
        // TODO: Add message validation when Message model is available
        break;
    }
  }

  /**
   * Validate that the factor (post/comment/message) exists
   */
  private async validateFactor(factorId: string, typeFactor: TypeFactor): Promise<void> {
    const id = new Types.ObjectId(factorId);

    switch (typeFactor) {
      case TypeFactor.POST:
        const post = await this.postModel.findById(id);
        if (!post) throw new NotFoundException('Post not found');
        // Check if reactions are allowed
        if (post.allowReactions === false) {
          throw new BadRequestException('Tương tác đã bị tắt cho bài viết này');
        }
        break;
      case TypeFactor.COMMENT:
        const comment = await this.commentModel.findById(id);
        if (!comment) throw new NotFoundException('Comment not found');
        break;
      case TypeFactor.MESSAGE:
        // TODO: Add message validation when Message model is available
        break;
    }
  }

  /**
   * Update the reaction count on the factor
   */
  private async updateFactorReactCount(
    factorId: string,
    typeFactor: TypeFactor,
    delta: number
  ): Promise<number> {
    const id = new Types.ObjectId(factorId);

    switch (typeFactor) {
      case TypeFactor.POST:
        const post = await this.postModel.findByIdAndUpdate(
          id,
          { $inc: { totalReacts: delta } },
          { new: true }
        );
        return Math.max(0, post?.totalReacts ?? 0);
      case TypeFactor.COMMENT:
        const comment = await this.commentModel.findByIdAndUpdate(
          id,
          { $inc: { totalLikes: delta } },
          { new: true }
        );
        return Math.max(0, comment?.totalLikes ?? 0);
      case TypeFactor.MESSAGE:
        // TODO: Add message handling when available
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Get current reaction count for a factor
   */
  private async getFactorReactCount(factorId: string, typeFactor: TypeFactor): Promise<number> {
    const id = new Types.ObjectId(factorId);

    switch (typeFactor) {
      case TypeFactor.POST:
        const post = await this.postModel.findById(id);
        return post?.totalReacts ?? 0;
      case TypeFactor.COMMENT:
        const comment = await this.commentModel.findById(id);
        return comment?.totalLikes ?? 0;
      case TypeFactor.MESSAGE:
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Get user's reaction on a factor
   */
  async getUserReaction(factorId: string, typeFactor: TypeFactor, userId: string): Promise<any> {
    const reaction = await this.reactionModel
      .findOne({
        factorId: new Types.ObjectId(factorId),
        typeFactor,
        userId: new Types.ObjectId(userId),
      })
      .lean();
    return reaction;
  }

  /**
   * Legacy: Get user's reaction on a post
   */
  async getPostUserReaction(postId: string, userId: string): Promise<any> {
    return await this.getUserReaction(postId, TypeFactor.POST, userId);
  }

  /**
   * Legacy: Get user's reaction on a comment
   */
  async getCommentUserReaction(commentId: string, userId: string): Promise<any> {
    return this.getUserReaction(commentId, TypeFactor.COMMENT, userId);
  }

  /**
   * Get all reactions for a factor with counts by type
   */
  async getFactorReactions(
    factorId: string,
    typeFactor: TypeFactor,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const factorObjId = new Types.ObjectId(factorId);

    const [reactions, total, reactionCounts] = await Promise.all([
      this.reactionModel
        .find({ factorId: factorObjId, typeFactor })
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reactionModel.countDocuments({ factorId: factorObjId, typeFactor }),
      this.reactionModel.aggregate([
        { $match: { factorId: factorObjId, typeFactor } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    console.log(reactions);

    const counts: Record<ReactionType, number> = {
      LIKE: 0,
      LOVE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };
    reactionCounts.forEach((item) => {
      counts[item._id as ReactionType] = item.count;
    });

    return {
      data: reactions,
      counts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Legacy: Get all reactions for a post
   */
  async getPostReactions(postId: string, page: number = 1, limit: number = 20): Promise<any> {
    return this.getFactorReactions(postId, TypeFactor.POST, page, limit);
  }

  /**
   * Legacy: Get all reactions for a comment
   */
  async getCommentReactions(commentId: string, page: number = 1, limit: number = 20): Promise<any> {
    return this.getFactorReactions(commentId, TypeFactor.COMMENT, page, limit);
  }

  /**
   * Get reaction summary for multiple factors (for feed)
   */
  async getReactionsSummary(factorIds: string[], typeFactor: TypeFactor, userId: string) {
    const objectIds = factorIds.map((id) => new Types.ObjectId(id));

    const userReactions = await this.reactionModel
      .find({
        factorId: { $in: objectIds },
        typeFactor,
        userId: new Types.ObjectId(userId),
      })
      .lean();

    const reactionSummaries = await this.reactionModel.aggregate([
      { $match: { factorId: { $in: objectIds }, typeFactor } },
      { $group: { _id: { factorId: '$factorId', type: '$type' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      {
        $group: {
          _id: '$_id.factorId',
          reactions: { $push: { type: '$_id.type', count: '$count' } },
        },
      },
      { $project: { reactions: { $slice: ['$reactions', 3] } } },
    ]);

    const result: Record<
      string,
      { userReaction: ReactionType | null; topReactions: { type: ReactionType; count: number }[] }
    > = {};

    factorIds.forEach((factorId) => {
      const userReaction = userReactions.find((r) => r.factorId.toString() === factorId);
      const summary = reactionSummaries.find((s) => s._id.toString() === factorId);
      result[factorId] = {
        userReaction: userReaction?.type || null,
        topReactions: summary?.reactions || [],
      };
    });

    return result;
  }

  /**
   * Legacy: Get reaction summary for posts
   */
  async getPostsReactionsSummary(postIds: string[], userId: string) {
    return this.getReactionsSummary(postIds, TypeFactor.POST, userId);
  }

  /**
   * Legacy: Get reaction summary for comments
   */
  async getCommentsReactionsSummary(commentIds: string[], userId: string) {
    return this.getReactionsSummary(commentIds, TypeFactor.COMMENT, userId);
  }

  /**
   * Migrate old reactions (postId-based) to new schema (factorId-based)
   */
  async migrateOldReactions() {
    try {
      // Find reactions that have postId but no factorId
      const oldReactions = await this.reactionModel.find({
        $or: [{ factorId: { $exists: false } }, { typeFactor: { $exists: false } }],
      });

      let migratedCount = 0;
      for (const reaction of oldReactions) {
        const reactionObj = reaction.toObject() as any;

        // If it has postId, use that as factorId
        if (reactionObj.postId && !reactionObj.factorId) {
          await this.reactionModel.updateOne(
            { _id: reaction._id },
            {
              $set: {
                factorId: reactionObj.postId,
                typeFactor: TypeFactor.POST,
              },
            }
          );
          migratedCount++;
        }
      }

      // Drop old index and create new one
      try {
        await this.reactionModel.collection.dropIndex('postId_1_userId_1');
      } catch (e: any) {
        console.log('Old index may not exist:', e.message);
      }

      // Create new index
      try {
        await this.reactionModel.collection.createIndex(
          { factorId: 1, typeFactor: 1, userId: 1 },
          { unique: true }
        );
      } catch (e: any) {
        console.log('New index may already exist:', e.message);
      }

      return {
        success: true,
        migratedCount,
        message: `Migrated ${migratedCount} reactions to new schema`,
      };
    } catch (error: any) {
      console.error('Migration error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
