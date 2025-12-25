import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Post, PostDocument } from 'src/post/entities/post.entity';

@Injectable()
export class CommentService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Post.name) private postModel: Model<PostDocument>
  ) {}

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
      .findByIdAndUpdate(id, updateCommentDto, { new: true })
      .populate('userId', 'firstName lastName avatar');

    return updated;
  }

  async remove(id: string, userId: string) {
    const comment = await this.commentModel.findById(id);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId.toString() !== userId) {
      throw new BadRequestException('You can only delete your own comments');
    }

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
