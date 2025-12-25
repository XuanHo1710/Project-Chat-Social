import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument, PostPrivacy } from './entities/post.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name)
    private postModel: Model<PostDocument>
  ) {}

  async create(createPostDto: CreatePostDto): Promise<Post> {
    // Validate: phải có content hoặc media
    if (!createPostDto.content && (!createPostDto.media || createPostDto.media.length === 0)) {
      throw new BadRequestException('Post must have content or media');
    }

    const newPost = new this.postModel({
      ...createPostDto,
      userId: new Types.ObjectId(createPostDto.userId),
      privacy: createPostDto.privacy || PostPrivacy.PUBLIC,
      isActive: true,
    });

    return newPost.save();
  }

  async findAll(
    page = 1,
    limit = 10,
    userId?: string
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    // Build query filter
    const filter: Record<string, unknown> = {
      isDeleted: false,
      isActive: true,
    };

    // If userId provided, filter by user's posts
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    }

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findNewsFeed(
    currentUserId: string,
    page = 1,
    limit = 10,
    friendIds: string[] = []
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    // Build query for news feed:
    // 1. PUBLIC posts from anyone
    // 2. FRIEND posts from friends
    // 3. Own posts (any privacy)
    const currentUserObjId = new Types.ObjectId(currentUserId);
    const friendObjIds = friendIds.map((id) => new Types.ObjectId(id));

    const filter = {
      isDeleted: false,
      isActive: true,
      $or: [
        { privacy: PostPrivacy.PUBLIC },
        { privacy: PostPrivacy.FRIEND, userId: { $in: friendObjIds } },
        { userId: currentUserObjId },
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('userId', 'firstName lastName avatar username')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 10
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const filter = {
      userId: new Types.ObjectId(userId),
      isDeleted: false,
      isActive: true,
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updatePostDto: UpdatePostDto, currentUserId: string): Promise<Post> {
    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check ownership - handle both populated and non-populated userId
    const postOwnerId =
      typeof post.userId === 'object' && post.userId !== null
        ? (post.userId as any)._id?.toString() || (post.userId as any).toString()
        : String(post.userId);

    if (postOwnerId !== currentUserId) {
      throw new BadRequestException('You can only edit your own posts');
    }

    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, { $set: updatePostDto }, { new: true })
      .populate('userId', 'firstName lastName avatar username')
      .exec();

    return updatedPost!;
  }

  async remove(id: string, currentUserId: string): Promise<{ message: string }> {
    const post = await this.postModel.findOne({
      _id: new Types.ObjectId(id),
      isDeleted: false,
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId.toString() !== currentUserId) {
      throw new BadRequestException('You can only delete your own posts');
    }

    // Soft delete
    await this.postModel.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    return { message: 'Post deleted successfully' };
  }

  // Helper methods for reactions/comments (can be expanded later)
  async incrementReacts(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { totalReacts: 1 } });
  }

  async decrementReacts(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { totalReacts: -1 } });
  }

  async incrementComments(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { totalComments: 1 } });
  }

  async incrementShares(id: string): Promise<void> {
    await this.postModel.findByIdAndUpdate(id, { $inc: { totalShares: 1 } });
  }
}
