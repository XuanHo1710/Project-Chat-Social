import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument, PostPrivacy, MediaItem } from './entities/post.entity';
import { HashtagService } from 'src/hashtag/hashtag.service';
import { HashtagEntityType } from 'src/hashtag/entities/hashtag-mapping.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ReactionService } from 'src/reaction/reaction.service';
import { TypeFactor } from 'src/reaction/entities/reaction.entity';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { AIResponse } from 'src/recommendation/types';
import { firstValueFrom } from 'rxjs';
interface ReactInfo {
  isReact: boolean;
  type: string | null;
}

export interface PostWithReactInfo extends Post {
  reactInfo?: ReactInfo;
}

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name)
    private postModel: Model<PostDocument>,
    private hashtagService: HashtagService,
    private reactionService: ReactionService,
    private cloudinaryService: CloudinaryService,
    private readonly httpService: HttpService
  ) {}
  private readonly aiServerUrl = 'http://localhost:8000/api/v1';

  async create(createPostDto: CreatePostDto): Promise<Post> {
    // Validate: phải có content hoặc media hoặc sharedPostId
    if (
      !createPostDto.content &&
      (!createPostDto.media || createPostDto.media.length === 0) &&
      !createPostDto.sharedPostId
    ) {
      throw new BadRequestException('Post must have content, media, or be a shared post');
    }

    // If sharing a post, check if sharing is allowed and increment share count
    if (createPostDto.sharedPostId) {
      const originalPost = await this.postModel.findById(createPostDto.sharedPostId);
      if (!originalPost) {
        throw new NotFoundException('Bài viết gốc không tồn tại');
      }
      if (originalPost.allowShares === false) {
        throw new BadRequestException('Chia sẻ đã bị tắt cho bài viết này');
      }
      await this.postModel.findByIdAndUpdate(createPostDto.sharedPostId, {
        $inc: { totalShares: 1 },
      });
    }

    const newPost = new this.postModel({
      ...createPostDto,
      userId: new Types.ObjectId(createPostDto.userId),
      sharedPostId: createPostDto.sharedPostId
        ? new Types.ObjectId(createPostDto.sharedPostId)
        : null,
      groupId: createPostDto.groupId ? new Types.ObjectId(createPostDto.groupId) : null,
      isAnonymous: createPostDto.isAnonymous || false,
      privacy: createPostDto.groupId
        ? PostPrivacy.GROUP
        : createPostDto.privacy || PostPrivacy.PUBLIC,
      isActive: true,
    });

    const savedPost = await newPost.save();

    // Process hashtags from content (if any)
    if (createPostDto.content) {
      await this.hashtagService.processHashtags(
        createPostDto.content,
        savedPost._id.toString(),
        HashtagEntityType.POST,
        createPostDto.userId
      );
    }

    return savedPost;
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
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
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
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    const currentUserObjId = new Types.ObjectId(currentUserId);
    const friendObjIds = friendIds.map((id) => new Types.ObjectId(id));

    // Try to use AI server for recommendations (auto-detects LLM availability)
    try {
      const responseAPIAi: AxiosResponse<{
        posts: { post_id: string; score: number }[];
        total: number;
      }> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/newsfeed/${currentUserId}`, {
          params: {
            friend_ids: friendIds.join(','),
            limit,
            page,
          },
          timeout: 30000,
        })
      );

      const postRelevantIds = responseAPIAi.data.posts.map((post) => post.post_id);
      const scoreMap = new Map(responseAPIAi.data.posts.map((p) => [p.post_id, p.score]));

      if (postRelevantIds.length > 0) {
        const dataPosts = await this.postModel
          .find({ _id: { $in: postRelevantIds }, isDeleted: false, isActive: true })
          .populate('userId', 'firstName lastName avatar username')
          .populate('groupId', 'name avatar privacy')
          .populate({
            path: 'sharedPostId',
            populate: { path: 'userId', select: 'firstName lastName avatar username' },
          })
          .lean()
          .exec();

        const postMap = new Map(dataPosts.map((post) => [post._id.toString(), post]));

        // Sort by AI score (highest first)
        const sortedPosts = postRelevantIds
          .map((postId) => {
            const post = postMap.get(postId);
            if (!post) return null;
            return { ...post, aiScore: scoreMap.get(postId) || 0 };
          })
          .filter((post) => post !== null);

        // Filter private group posts
        const filteredData = sortedPosts.filter((post) => {
          if (!post.groupId) return true;
          const group = post.groupId as any;
          if (group.privacy === 'PUBLIC') return true;
          return post.userId && (post.userId as any)._id?.toString() === currentUserId;
        });

        // Add reactions info
        const postIds = filteredData.map((p) => p._id);
        const postIdStrings = postIds.map((id) => id.toString());

        const [userReactions, reactionsSummary] = await Promise.all([
          this.reactionService.userReactions(postIds, currentUserId),
          this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
        ]);

        const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

        (filteredData as PostWithReactInfo[]).forEach((post) => {
          const postIdStr = post._id.toString();
          const r = reactionMap.get(postIdStr) as any;
          const summary = reactionsSummary[postIdStr];

          post.reactInfo = { isReact: !!r, type: r ? r.type : null };
          (post as any).topReactions = summary?.topReactions || [];
        });

        return {
          data: filteredData as PostWithReactInfo[],
          total: responseAPIAi.data.total,
          page,
          totalPages: Math.ceil(responseAPIAi.data.total / limit),
        };
      }
    } catch (error) {
      console.warn('AI Server unavailable, falling back to standard newsfeed:', error.message);
    }

    // Fallback: Standard MongoDB query (original logic)
    const skip = (page - 1) * limit;
    const filter = {
      isDeleted: false,
      isActive: true,
      $or: [
        { privacy: PostPrivacy.PUBLIC },
        { privacy: PostPrivacy.FRIEND, userId: { $in: friendObjIds } },
        { userId: currentUserObjId },
        { privacy: PostPrivacy.GROUP, groupId: { $ne: null } },
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 20)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const filteredData = data
      .filter((post) => {
        if (!post.groupId) return true;
        const group = post.groupId as any;
        if (group.privacy === 'PUBLIC') return true;
        return post.userId && (post.userId as any)._id?.toString() === currentUserId;
      })
      .slice(0, limit);

    const postIds = filteredData.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, currentUserId),
      this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
    ]);

    const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

    (filteredData as PostWithReactInfo[]).forEach((post) => {
      const postIdStr = post._id.toString();
      const r = reactionMap.get(postIdStr) as any;
      const summary = reactionsSummary[postIdStr];

      post.reactInfo = { isReact: !!r, type: r ? r.type : null };
      (post as any).topReactions = summary?.topReactions || [];
    });

    return {
      data: filteredData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async searchWithModelAIServer(
    currentUserId: string,
    page = 1,
    limit = 10,
    friendIds: string[] = [],
    keyword?: string
  ): Promise<any> {
    const currentUserObjId = new Types.ObjectId(currentUserId);

    if (!keyword || keyword.trim().length === 0) {
      return { data: [], total: 0, page, totalPages: 0 };
    }

    try {
      // Call AI server search (auto-detects LLM availability on server side)
      const responseAPIAi: AxiosResponse<{
        posts: { post_id: string; score: number }[];
        total: number;
      }> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/search`, {
          params: {
            q: keyword,
            current_user_id: currentUserId,
            friend_ids: friendIds.join(','),
            limit,
            page,
            apply_privacy_filter: true,
          },
          timeout: 30000,
        })
      );

      const postRelevantIds = responseAPIAi.data.posts.map((post) => post.post_id);
      const scoreMap = new Map(responseAPIAi.data.posts.map((p) => [p.post_id, p.score]));

      if (postRelevantIds.length === 0) {
        return {
          data: [],
          total: 0,
          page,
          totalPages: 0,
        };
      }

      // Fetch posts from DB
      const dataPosts = await this.postModel
        .find({ _id: { $in: postRelevantIds }, isDeleted: false, isActive: true })
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .lean()
        .exec();

      const postMap = new Map(dataPosts.map((post) => [post._id.toString(), post]));

      // Keep AI ordering and add scores
      const sortedPosts = postRelevantIds
        .map((postId) => {
          const post = postMap.get(postId);
          if (!post) return null;
          return { ...post, aiScore: scoreMap.get(postId) || 0 };
        })
        .filter((post) => post !== null);

      // Filter private group posts
      const filteredData = sortedPosts.filter((post) => {
        if (!post.groupId) return true;
        const group = post.groupId as any;
        if (group.privacy === 'PUBLIC') return true;
        return post.userId && (post.userId as any)._id?.toString() === currentUserId;
      });

      // Add reactions info
      const postIds = filteredData.map((p) => p._id);
      const postIdStrings = postIds.map((id) => id.toString());

      const [userReactions, reactionsSummary] = await Promise.all([
        this.reactionService.userReactions(postIds, currentUserId),
        this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
      ]);

      const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

      (filteredData as PostWithReactInfo[]).forEach((post) => {
        const postIdStr = post._id.toString();
        const r = reactionMap.get(postIdStr) as any;
        const summary = reactionsSummary[postIdStr];

        post.reactInfo = { isReact: !!r, type: r ? r.type : null };
        (post as any).topReactions = summary?.topReactions || [];
      });

      return {
        data: filteredData,
        total: responseAPIAi.data.total,
        page,
        totalPages: Math.ceil(responseAPIAi.data.total / limit),
      };
    } catch (error) {
      console.error('AI Server search failed:', error.message);

      // Fallback: basic text search with MongoDB
      const friendObjIds = friendIds.map((id) => new Types.ObjectId(id));
      const skip = (page - 1) * limit;

      const filter = {
        isDeleted: false,
        isActive: true,
        $text: { $search: keyword },
        $or: [
          { privacy: PostPrivacy.PUBLIC },
          { privacy: PostPrivacy.FRIEND, userId: { $in: friendObjIds } },
          { userId: currentUserObjId },
          { privacy: PostPrivacy.GROUP, groupId: { $ne: null } },
        ],
      };

      try {
        const [data, total] = await Promise.all([
          this.postModel
            .find(filter)
            .populate('userId', 'firstName lastName avatar username')
            .populate('groupId', 'name avatar privacy')
            .populate({
              path: 'sharedPostId',
              populate: { path: 'userId', select: 'firstName lastName avatar username' },
            })
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
          this.postModel.countDocuments(filter),
        ]);

        const postIds = data.map((p) => p._id);
        const postIdStrings = postIds.map((id) => id.toString());

        const [userReactions, reactionsSummary] = await Promise.all([
          this.reactionService.userReactions(postIds, currentUserId),
          this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
        ]);

        const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

        (data as PostWithReactInfo[]).forEach((post) => {
          const postIdStr = post._id.toString();
          const r = reactionMap.get(postIdStr) as any;
          const summary = reactionsSummary[postIdStr];

          post.reactInfo = { isReact: !!r, type: r ? r.type : null };
          (post as any).topReactions = summary?.topReactions || [];
        });

        return { data, total, page, totalPages: Math.ceil(total / limit), llmInfo: null };
      } catch {
        return { data: [], total: 0, page, totalPages: 0, llmInfo: null };
      }
    }
  }

  /**
   * Get video reels - posts that contain VIDEO media type
   */
  async findVideoReels(
    currentUserId: string,
    page = 1,
    limit = 10,
    friendIds: string[] = []
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const currentUserObjId = new Types.ObjectId(currentUserId);
    const friendObjIds = friendIds.map((id) => new Types.ObjectId(id));

    // Filter for posts with VIDEO media and proper privacy
    const filter = {
      isDeleted: false,
      isActive: true,
      'media.mediaType': 'VIDEO', // Only posts with VIDEO media
      $or: [
        { privacy: PostPrivacy.PUBLIC },
        { privacy: PostPrivacy.FRIEND, userId: { $in: friendObjIds } },
        { userId: currentUserObjId },
        { privacy: PostPrivacy.GROUP, groupId: { $ne: null } },
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit + 10) // Extra for filtering
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    // Filter out private group posts where user is not the author
    const filteredData = data
      .filter((post) => {
        if (!post.groupId) return true;
        const group = post.groupId as any;
        if (group.privacy === 'PUBLIC') return true;
        return post.userId && (post.userId as any)._id?.toString() === currentUserId;
      })
      .slice(0, limit);

    const postIds = filteredData.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    // Get user reactions and top reactions summary in parallel
    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, currentUserId),
      this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
    ]);

    const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

    (filteredData as PostWithReactInfo[]).forEach((post) => {
      const postIdStr = post._id.toString();
      const r = reactionMap.get(postIdStr) as any;
      const summary = reactionsSummary[postIdStr];

      post.reactInfo = {
        isReact: !!r,
        type: r ? r.type : null,
      };
      (post as any).topReactions = summary?.topReactions || [];
    });

    return {
      data: filteredData,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Post> {
    const post = await this.postModel
      .findOne({ _id: new Types.ObjectId(id), isDeleted: false })
      .populate('userId', 'firstName lastName avatar username')
      .populate({
        path: 'sharedPostId',
        populate: { path: 'userId', select: 'firstName lastName avatar username' },
      })
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  async findByUserId(
    userId: string,
    page = 1,
    limit = 10,
    currentUserId?: string,
    friendIds: string[] = []
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const targetUserObjId = new Types.ObjectId(userId);

    // Build privacy filter based on viewer:
    // 1. Own profile: see all posts
    // 2. Friend viewing: see PUBLIC + FRIEND posts
    // 3. Non-friend viewing: see PUBLIC posts only
    let privacyFilter: Record<string, unknown>;

    const isOwnProfile = currentUserId === userId;
    const isFriend = currentUserId && friendIds.includes(userId);

    if (isOwnProfile) {
      // Own profile - see all posts
      privacyFilter = {
        userId: targetUserObjId,
        isDeleted: false,
        isActive: true,
      };
    } else if (isFriend) {
      // Friend - see PUBLIC and FRIEND posts
      privacyFilter = {
        userId: targetUserObjId,
        isDeleted: false,
        isActive: true,
        privacy: { $in: [PostPrivacy.PUBLIC, PostPrivacy.FRIEND] },
      };
    } else {
      // Non-friend/Guest - see PUBLIC posts only
      privacyFilter = {
        userId: targetUserObjId,
        isDeleted: false,
        isActive: true,
        privacy: PostPrivacy.PUBLIC,
      };
    }

    const [data, total] = await Promise.all([
      this.postModel
        .find(privacyFilter)
        .populate('userId', 'firstName lastName avatar username')
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(privacyFilter),
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

    // Xóa media cũ không còn trong danh sách mới
    if (updatePostDto.media !== undefined && post.media && post.media.length > 0) {
      const newPublicIds = new Set((updatePostDto.media || []).map((m) => m.publicId));
      const mediaToDelete = post.media
        .filter((oldMedia) => oldMedia.publicId && !newPublicIds.has(oldMedia.publicId))
        .map((media) => ({
          publicId: media.publicId,
          mediaType: media.mediaType === 'VIDEO' ? ('VIDEO' as const) : ('IMAGE' as const),
        }));

      if (mediaToDelete.length > 0) {
        // Xóa async, không block response
        this.cloudinaryService.deleteMultipleMedia(mediaToDelete).catch((err) => {
          console.error('Failed to delete old media from Cloudinary:', err);
        });
      }
    }

    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, { $set: updatePostDto }, { new: true })
      .populate('userId', 'firstName lastName avatar username')
      .exec();

    // Update hashtags if content changed
    if (updatePostDto.content !== undefined) {
      await this.hashtagService.updateHashtags(
        updatePostDto.content || '',
        id,
        HashtagEntityType.POST,
        currentUserId
      );
    }

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

    // Xóa media trên Cloudinary nếu có
    if (post.media && post.media.length > 0) {
      const mediaToDelete = post.media
        .filter((media) => media.publicId)
        .map((media) => ({
          publicId: media.publicId,
          mediaType: media.mediaType === 'VIDEO' ? ('VIDEO' as const) : ('IMAGE' as const),
        }));

      if (mediaToDelete.length > 0) {
        // Xóa async, không block response
        this.cloudinaryService.deleteMultipleMedia(mediaToDelete).catch((err) => {
          console.error('Failed to delete post media from Cloudinary:', err);
        });
      }
    }

    // Remove hashtag mappings
    await this.hashtagService.removeHashtagMappings(id, HashtagEntityType.POST);

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

  // Get posts by group
  async findByGroupId(
    groupId: string,
    currentUserId: string,
    page = 1,
    limit = 10
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const filter = {
      isDeleted: false,
      isActive: true,
      groupId: new Types.ObjectId(groupId),
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const postIds = data.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    // Get user reactions and top reactions summary in parallel
    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, currentUserId),
      this.reactionService.getPostsReactionsSummary(postIdStrings, currentUserId),
    ]);

    const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

    (data as PostWithReactInfo[]).forEach((post) => {
      const postIdStr = post._id.toString();
      const r = reactionMap.get(postIdStr) as any;
      const summary = reactionsSummary[postIdStr];

      post.reactInfo = {
        isReact: !!r,
        type: r ? r.type : null,
      };
      (post as any).topReactions = summary?.topReactions || [];
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
