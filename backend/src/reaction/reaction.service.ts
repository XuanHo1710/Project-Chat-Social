import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reaction, ReactionDocument, ReactionType } from './entities/reaction.entity';
import { CreateReactionDto } from './dto/create-reaction.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';

@Injectable()
export class ReactionService {
  constructor(
    @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>
  ) { }

  /**
   * Toggle reaction on a post
   * - If user hasn't reacted: add reaction
   * - If user reacted with same type: remove reaction
   * - If user reacted with different type: update reaction
   */
  async toggleReaction(createReactionDto: CreateReactionDto, userId: string) {
    const { postId, type } = createReactionDto;

    // Check if post exists
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Use findOneAndUpdate for atomic operation to prevent race conditions
    const existingReaction = await this.reactionModel.findOne({
      postId: new Types.ObjectId(postId),
      userId: new Types.ObjectId(userId),
    });

    if (existingReaction) {
      if (existingReaction.type === type) {
        // Same reaction type - remove it
        await this.reactionModel.findByIdAndDelete(existingReaction._id);
        const updatedPost = await this.postModel.findByIdAndUpdate(
          postId,
          { $inc: { totalReacts: -1 } },
          { new: true }
        );
        return {
          action: 'removed',
          reaction: null,
          totalReacts: Math.max(0, updatedPost?.totalReacts ?? 0),
        };
      } else {
        // Different reaction type - update it
        await this.reactionModel.updateOne({ _id: existingReaction._id }, { type: type });
        return {
          action: 'updated',
          reaction: { ...existingReaction.toObject(), type },
          totalReacts: post.totalReacts,
        };
      }
    } else {
      // No existing reaction - try to create new one
      try {
        const reaction = new this.reactionModel({
          postId: new Types.ObjectId(postId),
          userId: new Types.ObjectId(userId),
          type,
        });
        await reaction.save();

        const updatedPost = await this.postModel.findByIdAndUpdate(
          postId,
          { $inc: { totalReacts: 1 } },
          { new: true }
        );

        return {
          action: 'added',
          reaction,
          totalReacts: updatedPost?.totalReacts ?? post.totalReacts + 1,
        };
      } catch (error: any) {
        // Handle duplicate key error (race condition - reaction was created by another request)
        if (error.code === 11000) {
          // Reaction already exists, fetch current state and return
          const currentReaction = await this.reactionModel.findOne({
            postId: new Types.ObjectId(postId),
            userId: new Types.ObjectId(userId),
          });
          const currentPost = await this.postModel.findById(postId);

          if (currentReaction && currentReaction.type !== type) {
            // Update to the new type
            await this.reactionModel.updateOne({ _id: currentReaction._id }, { type });
            return {
              action: 'updated',
              reaction: { ...currentReaction.toObject(), type },
              totalReacts: currentPost?.totalReacts ?? post.totalReacts,
            };
          }

          return {
            action: 'exists',
            reaction: currentReaction,
            totalReacts: currentPost?.totalReacts ?? post.totalReacts,
          };
        }
        throw error;
      }
    }
  }

  /**
   * Get user's reaction on a post
   */
  async getUserReaction(postId: string, userId: string): Promise<any> {
    const reaction = await this.reactionModel
      .findOne({
        postId: new Types.ObjectId(postId),
        userId: new Types.ObjectId(userId),
      })
      .lean();

    return reaction;
  }

  /**
   * Get all reactions for a post with counts by type
   */
  async getPostReactions(postId: string, page: number = 1, limit: number = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const [reactions, total, reactionCounts] = await Promise.all([
      this.reactionModel
        .find({ postId: new Types.ObjectId(postId) })
        .populate('userId', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reactionModel.countDocuments({ postId: new Types.ObjectId(postId) }),
      this.reactionModel.aggregate([
        { $match: { postId: new Types.ObjectId(postId) } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),
    ]);

    // Convert aggregation result to object
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get reaction summary for multiple posts (for feed)
   */
  async getReactionsSummary(postIds: string[], userId: string) {
    const objectIds = postIds.map((id) => new Types.ObjectId(id));

    // Get user's reactions for these posts
    const userReactions = await this.reactionModel
      .find({
        postId: { $in: objectIds },
        userId: new Types.ObjectId(userId),
      })
      .lean();

    // Get top 3 reaction types for each post
    const reactionSummaries = await this.reactionModel.aggregate([
      { $match: { postId: { $in: objectIds } } },
      { $group: { _id: { postId: '$postId', type: '$type' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      {
        $group: {
          _id: '$_id.postId',
          reactions: {
            $push: { type: '$_id.type', count: '$count' },
          },
        },
      },
      {
        $project: {
          reactions: { $slice: ['$reactions', 3] },
        },
      },
    ]);

    // Build result map
    const result: Record<
      string,
      { userReaction: ReactionType | null; topReactions: { type: ReactionType; count: number }[] }
    > = {};

    postIds.forEach((postId) => {
      const userReaction = userReactions.find((r) => r.postId.toString() === postId);
      const summary = reactionSummaries.find((s) => s._id.toString() === postId);

      result[postId] = {
        userReaction: userReaction?.type || null,
        topReactions: summary?.reactions || [],
      };
    });

    return result;
  }
}
