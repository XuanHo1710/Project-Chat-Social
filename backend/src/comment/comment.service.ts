import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './entities/comment.entity';
import {
  CommentReaction,
  CommentReactionDocument,
  CommentReactionType,
} from './entities/comment-reaction.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CreateCommentReactionDto } from './dto/create-comment-reaction.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { HashtagService } from 'src/hashtag/hashtag.service';
import { HashtagEntityType } from 'src/hashtag/entities/hashtag-mapping.entity';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(CommentReaction.name) private commentReactionModel: Model<CommentReactionDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private cloudinaryService: CloudinaryService,
    private hashtagService: HashtagService,
  ) { }

  async create(createCommentDto: CreateCommentDto, userId: string) {
    const { postId, parentId, ...rest } = createCommentDto;

    // Check if post exists
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
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
        userId,
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

  async findByPostId(postId: string, page: number = 1, limit: number = 10): Promise<any> {
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

    return {
      data: comments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findReplies(commentId: string, page: number = 1, limit: number = 5): Promise<any> {
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

    return {
      data: replies,
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
      .findByIdAndUpdate(
        id,
        { ...updateCommentDto, isEdited: true },
        { new: true }
      )
      .populate('userId', 'firstName lastName avatar');

    // Update hashtags if content changed
    if (updateCommentDto.content !== undefined) {
      await this.hashtagService.updateHashtags(
        updateCommentDto.content || '',
        id,
        HashtagEntityType.COMMENT,
        userId,
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

    // Delete all reactions for this comment
    await this.commentReactionModel.deleteMany({ commentId: new Types.ObjectId(id) });

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

  // ==================== COMMENT REACTIONS ====================

  /**
   * Toggle reaction on a comment
   * - If user hasn't reacted: add reaction
   * - If user reacted with same type: remove reaction
   * - If user reacted with different type: update reaction
   */
  async toggleReaction(createReactionDto: CreateCommentReactionDto, userId: string) {
    const { commentId, type } = createReactionDto;

    // Check if comment exists
    const comment = await this.commentModel.findById(commentId);
    if (!comment || !comment.isActive) {
      throw new NotFoundException('Comment not found');
    }

    // Check if user already reacted
    const existingReaction = await this.commentReactionModel.findOne({
      commentId: new Types.ObjectId(commentId),
      userId: new Types.ObjectId(userId),
    });

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction type - remove it
        await this.commentReactionModel.findByIdAndDelete(existingReaction._id);
        await this.commentModel.findByIdAndUpdate(commentId, {
          $inc: { totalLikes: -1 },
        });
        return {
          action: 'removed',
          reaction: null,
          totalLikes: comment.totalLikes - 1,
        };
      } else {
        // Different reaction type - update it
        existingReaction.type = type;
        await this.commentReactionModel.updateOne({ _id: existingReaction._id }, { type: type });
        await existingReaction.populate('userId', 'firstName lastName avatar');
        return {
          action: 'updated',
          reaction: existingReaction,
          totalLikes: comment.totalLikes,
        };
      }
    } else {
      // No existing reaction - create new one
      const reaction = new this.commentReactionModel({
        commentId: new Types.ObjectId(commentId),
        userId: new Types.ObjectId(userId),
        type,
      });
      await reaction.save();
      await reaction.populate('userId', 'firstName lastName avatar');

      await this.commentModel.findByIdAndUpdate(commentId, {
        $inc: { totalLikes: 1 },
      });

      return {
        action: 'added',
        reaction,
        totalLikes: comment.totalLikes + 1,
      };
    }
  }

  /**
   * Get user's reaction on a comment
   */
  async getUserReaction(commentId: string, userId: string): Promise<any> {
    const reaction = await this.commentReactionModel
      .findOne({
        commentId: new Types.ObjectId(commentId),
        userId: new Types.ObjectId(userId),
      })
      .lean();

    return reaction;
  }

  /**
   * Get all reactions for a comment with counts by type
   */
  async getCommentReactions(commentId: string, page: number = 1, limit: number = 20): Promise<any> {
    const skip = (page - 1) * limit;

    // Get reaction counts by type
    const reactionCounts = await this.commentReactionModel.aggregate([
      { $match: { commentId: new Types.ObjectId(commentId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);

    // Get paginated reactions with user info
    const [reactions, total] = await Promise.all([
      this.commentReactionModel
        .find({ commentId: new Types.ObjectId(commentId) })
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.commentReactionModel.countDocuments({ commentId: new Types.ObjectId(commentId) }),
    ]);

    // Format counts
    const counts: Record<string, number> = {};
    reactionCounts.forEach((rc) => {
      counts[rc._id] = rc.count;
    });

    return {
      data: reactions,
      counts,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
