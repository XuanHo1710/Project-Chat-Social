import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import {
  Post,
  PostDocument,
  PostPrivacy,
  MediaItem,
  LivestreamStatus,
} from './entities/post.entity';

import { HashtagService } from 'src/hashtag/hashtag.service';
import { HashtagEntityType } from 'src/hashtag/entities/hashtag-mapping.entity';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ReactionService } from 'src/reaction/reaction.service';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ApiVideoService } from 'src/common/services/api-video.service';
import { NotificationEmitterService } from 'src/notification/notification-emitter.service';
import { NotificationService } from 'src/notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { KafkaProducerService } from 'src/kafka/kafka-producer.service';
import { RelationshipService } from 'src/relationship/relationship.service';
import { GroupService } from 'src/group/group.service';
interface ReactInfo {
  isReact: boolean;
  type: string | null;
}

export interface PostWithReactInfo extends Post {
  reactInfo?: ReactInfo;
}

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);
  private readonly aiServerUrl: string;
  private readonly aiInternalApiKey: string;

  constructor(
    @InjectModel(Post.name)
    private postModel: Model<PostDocument>,
    private hashtagService: HashtagService,
    private reactionService: ReactionService,
    private cloudinaryService: CloudinaryService,
    private readonly httpService: HttpService,
    private apiVideoService: ApiVideoService,
    private notificationEmitter: NotificationEmitterService,
    private notificationService: NotificationService,
    private configService: ConfigService,
    private kafkaProducer: KafkaProducerService,
    private relationshipService: RelationshipService,
    private groupService: GroupService
  ) {
    this.aiServerUrl = (this.configService.get<string>('AI_SERVER_URL') || '').replace(/\/$/, '');
    this.aiInternalApiKey = this.configService.get<string>('AI_INTERNAL_API_KEY') || '';
  }

  private aiRequestConfig(timeout: number): {
    timeout: number;
    headers: { 'X-AI-API-Key': string };
  } {
    if (!this.aiServerUrl || !this.aiInternalApiKey) {
      throw new Error('AI server integration is not configured');
    }
    return {
      timeout,
      headers: { 'X-AI-API-Key': this.aiInternalApiKey },
    };
  }

  private clampPagination(page: number, limit: number): { page: number; limit: number } {
    return {
      page: Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1),
      limit: Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 10)),
    };
  }

  private async getVisibilityContext(currentUserId: string): Promise<{
    filter: Record<string, unknown>;
    friendIds: string[];
    accessibleGroupIds: string[];
  }> {
    if (!Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Invalid user identifier');
    }

    const [friendIds, accessibleGroupIds] = await Promise.all([
      this.relationshipService.getAcceptedFriendIdStrings(currentUserId),
      this.groupService.getAccessibleGroupIds(currentUserId),
    ]);
    const currentUserObjectId = new Types.ObjectId(currentUserId);
    const friendObjectIds = friendIds.map((id) => new Types.ObjectId(id));
    const groupObjectIds = accessibleGroupIds.map((id) => new Types.ObjectId(id));

    const filter = {
      $or: [
        { userId: currentUserObjectId, groupId: null },
        { privacy: PostPrivacy.PUBLIC, groupId: null },
        {
          privacy: PostPrivacy.FRIEND,
          groupId: null,
          userId: { $in: friendObjectIds },
        },
        {
          privacy: PostPrivacy.GROUP,
          groupId: { $in: groupObjectIds },
        },
      ],
    };

    return { filter, friendIds, accessibleGroupIds };
  }

  private async buildVisibilityFilter(currentUserId: string): Promise<Record<string, unknown>> {
    return (await this.getVisibilityContext(currentUserId)).filter;
  }

  async canViewPost(postId: string, currentUserId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(postId)) return false;
    const visibility = await this.buildVisibilityFilter(currentUserId);
    const post = await this.postModel.exists({
      _id: new Types.ObjectId(postId),
      isDeleted: false,
      isActive: true,
      ...visibility,
    });
    return !!post;
  }

  async getLivestreamAccess(
    postId: string,
    currentUserId: string
  ): Promise<{ canView: boolean; isBroadcaster: boolean }> {
    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(currentUserId)) {
      return { canView: false, isBroadcaster: false };
    }
    const visibility = await this.buildVisibilityFilter(currentUserId);
    const post = await this.postModel
      .findOne({
        $and: [
          {
            _id: postId,
            type: 'LIVESTREAM',
            livestreamStatus: LivestreamStatus.LIVE,
            isDeleted: false,
            isActive: true,
          },
          visibility,
        ],
      })
      .select('userId')
      .lean();
    return {
      canView: !!post,
      isBroadcaster: !!post && post.userId.toString() === currentUserId,
    };
  }

  /**
   * Helper method to embed/upsert a post to AI server ChromaDB
   * Called after create/update to keep embeddings in sync
   */
  private async embedPostToAI(post: {
    _id: any;
    content?: string;
    userId: any;
    privacy?: string;
    groupId?: any;
    createdAt?: Date;
    media?: any[];
  }): Promise<void> {
    // Skip if no content or content too short
    if (!post.content || post.content.trim().length < 5) return;

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.aiServerUrl}/embed/post`,
          {
            post_id: post._id.toString(),
            content: post.content,
            user_id:
              typeof post.userId === 'object'
                ? post.userId._id?.toString() || post.userId.toString()
                : post.userId.toString(),
            privacy: post.privacy || 'PUBLIC',
            group_id: post.groupId ? post.groupId.toString() : null,
            created_at: post.createdAt ? post.createdAt.toISOString() : new Date().toISOString(),
            media_type:
              post.media && post.media.some((m) => m.mediaType === 'VIDEO')
                ? 'VIDEO'
                : post.media && post.media.length > 0
                  ? 'IMAGE'
                  : 'TEXT',
          },
          this.aiRequestConfig(10000)
        )
      );
    } catch (error: any) {
      // Log but don't throw - embedding is not critical for post creation
      this.logger.warn(`⚠️ Failed to embed post ${post._id}: ${error.message}`);
    }
  }

  /**
   * Helper method to delete a post embedding from AI server ChromaDB
   */
  private async deletePostEmbedding(postId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.aiServerUrl}/embed/post/${postId}`,
          this.aiRequestConfig(10000),
        )
      );
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to delete post embedding ${postId}: ${error.message}`);
    }
  }

  async create(createPostDto: CreatePostDto, user: any): Promise<Post> {
    const actorId = user?._id?.toString();
    if (!actorId || !Types.ObjectId.isValid(actorId)) {
      throw new BadRequestException('Invalid authenticated user');
    }
    if (createPostDto.media?.length) {
      await this.cloudinaryService.assertOwnedMedia(actorId, createPostDto.media);
    }

    // Validate: phải có content hoặc media hoặc sharedPostId
    if (
      !createPostDto.content &&
      (!createPostDto.media || createPostDto.media.length === 0) &&
      !createPostDto.sharedPostId
    ) {
      throw new BadRequestException('Post must have content, media, or be a shared post');
    }

    if (createPostDto.groupId) {
      const isMember = await this.groupService.isMember(actorId, createPostDto.groupId);
      if (!isMember) {
        throw new ForbiddenException('Only approved group members can publish group posts');
      }
    }

    let originalPost: {
      _id: Types.ObjectId;
      userId: Types.ObjectId;
      allowShares?: boolean;
    } | null = null;
    if (createPostDto.sharedPostId) {
      const visibility = await this.buildVisibilityFilter(actorId);
      originalPost = await this.postModel
        .findOne({
          $and: [
            {
              _id: new Types.ObjectId(createPostDto.sharedPostId),
              isDeleted: false,
              isActive: true,
            },
            visibility,
          ],
        })
        .select('userId allowShares')
        .lean<{ _id: Types.ObjectId; userId: Types.ObjectId; allowShares?: boolean }>();
      if (!originalPost) {
        throw new ForbiddenException('You cannot share this post');
      }
      if (originalPost.allowShares === false) {
        throw new BadRequestException('Chia sẻ đã bị tắt cho bài viết này');
      }
    }

    const newPost = new this.postModel({
      ...createPostDto,
      userId: new Types.ObjectId(actorId),
      content: createPostDto.content?.trim().slice(0, 10000),
      sharedPostId: createPostDto.sharedPostId
        ? new Types.ObjectId(createPostDto.sharedPostId)
        : null,
      groupId: createPostDto.groupId ? new Types.ObjectId(createPostDto.groupId) : null,
      isAnonymous: createPostDto.isAnonymous || false,
      privacy: createPostDto.groupId
        ? PostPrivacy.GROUP
        : createPostDto.privacy || PostPrivacy.PUBLIC,
      type: createPostDto.sharedPostId ? 'SHARE' : 'POST',
      livestreamStatus: null,
      isActive: true,
    });

    const savedPost = await newPost.save();

    if (originalPost) {
      const increment = await this.postModel.updateOne(
        {
          _id: originalPost._id,
          isDeleted: false,
          isActive: true,
          allowShares: { $ne: false },
        },
        { $inc: { totalShares: 1 } },
      );
      if (increment.modifiedCount !== 1) {
        await this.postModel.deleteOne({ _id: savedPost._id });
        throw new BadRequestException('The original post can no longer be shared');
      }
    }

    if (createPostDto.content) {
      this.hashtagService
        .processHashtags(
          createPostDto.content,
          savedPost._id.toString(),
          HashtagEntityType.POST,
          actorId,
        )
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to index hashtags for post ${savedPost._id}: ${message}`);
        });
    }

    if (createPostDto.sharedPostId && originalPost) {
        // Emit share notification via RabbitMQ
        await this.notificationEmitter.emitPostShared(
          originalPost.userId.toString(),
          actorId,
          savedPost._id.toString(),
          user.fullname || 'Ai đó',
          (createPostDto.content || '').trim().slice(0, 80) || undefined
        );

        // Emit Kafka Interaction for AI Learning
        this.kafkaProducer
          .emitInteractionPostShare(
            actorId,
            createPostDto.sharedPostId,
            savedPost._id.toString()
          )
          .catch((err) => this.logger.warn(`Kafka share error: ${err?.message || err}`));
    }

    await savedPost.populate([
      { path: 'userId', select: 'firstName lastName avatar username' },
      { path: 'groupId', select: 'name avatar privacy' },
      {
        path: 'sharedPostId',
        match: { isDeleted: false },
        populate: { path: 'userId', select: 'firstName lastName avatar username' },
      },
    ]);

    // Emit Kafka event for newsfeed fan-out (async, don't block response)
    // This will push the post to all followers' pre-computed feeds
    this.emitPostCreatedToKafka(savedPost, actorId).catch(() => {});

    return savedPost;
  }

  /**
   * Emit post created event to Kafka for fan-out to followers
   */
  private async emitPostCreatedToKafka(post: PostDocument, authorId: string): Promise<void> {
    try {
      // Get follower IDs from relationship service (simplified - in real app you'd inject RelationshipService)
      // For now, we'll emit without followerIds and let the kafka consumer handle fetching them
      await this.kafkaProducer.emitPostCreated(
        post._id.toString(),
        authorId,
        [], // Follower IDs will be fetched by Kafka consumer
        {
          content: post.content?.substring(0, 200),
          privacy: post.privacy,
          mediaType: post.media?.length > 0 ? (post.media[0] as any).type : undefined,
          groupId: post.groupId?.toString(),
        }
      );
    } catch (error: any) {
      this.logger.warn(`Failed to emit post to Kafka: ${error.message}`);
    }
  }

  // Adding the method properly after constructor update
  async startLivestream(
    userId: string,
    description: string,
    privacy: PostPrivacy = PostPrivacy.PUBLIC
  ): Promise<any> {
    if (!Types.ObjectId.isValid(userId) || !Object.values(PostPrivacy).includes(privacy)) {
      throw new BadRequestException('Invalid livestream owner or privacy');
    }
    if (privacy === PostPrivacy.GROUP) {
      throw new BadRequestException('Group livestreams require a group context');
    }
    description = (description || '').trim().slice(0, 10000);
    const liveStream = await this.apiVideoService.createLiveStream(
      description || `Livestream của ${userId}`
    );

    // Create Post immediately
    const newPost = new this.postModel({
      userId: new Types.ObjectId(userId),
      content: description,
      type: 'LIVESTREAM',
      livestreamStatus: 'LIVE',
      privacy: privacy,
      media: [
        {
          mediaType: 'VIDEO',
          url: liveStream.assets?.hls || '', // Use HLS URL if available
          publicId: liveStream.liveStreamId,
        },
      ],
      isActive: true,
      // Default counters
      totalReacts: 0,
      totalComments: 0,
      totalShares: 0,
    });

    const savedPost = await newPost.save();

    return {
      post: savedPost,
      streamKey: liveStream.streamKey, // IMPORTANT: Send this back to client for broadcasting
      RMTPUrl: 'rtmp://broadcast.api.video/s', // Standard entry point
      liveStreamId: liveStream.liveStreamId,
      hlsUrl: liveStream.assets?.hls,
    };
  }

  async endLivestream(postId: string, userId: string) {
    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid livestream identifier');
    }
    const post = await this.postModel.findOne({ _id: postId, userId: new Types.ObjectId(userId) });
    if (!post) throw new NotFoundException('Post not found');

    // Update status to ENDED
    post.livestreamStatus = LivestreamStatus.ENDED;

    // We could optionally fetch the latest assets from api.video to get the recorded MP4 or verify HLS
    // but for now, just marking as ENDED is enough. The HLS URL creates a VOD automatically.

    await post.save();
    return post;
  }

  async findAll(
    currentUserId: string,
    page = 1,
    limit = 10,
    authorId?: string
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    ({ page, limit } = this.clampPagination(page, limit));
    const skip = (page - 1) * limit;
    const visibility = await this.buildVisibilityFilter(currentUserId);

    // Build query filter
    const filter: Record<string, unknown> = {
      $and: [{ isDeleted: false, isActive: true }, visibility],
    };

    // If userId provided, filter by user's posts
    if (authorId) {
      if (!Types.ObjectId.isValid(authorId)) {
        throw new BadRequestException('Invalid author identifier');
      }
      (filter.$and as Record<string, unknown>[]).push({
        userId: new Types.ObjectId(authorId),
      });
    }

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate({
          path: 'sharedPostId',
          match: { isDeleted: false },
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    return {
      data: data as unknown as Post[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findNewsFeed(
    currentUserId: string,
    page = 1,
    limit = 10
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    ({ page, limit } = this.clampPagination(page, limit));
    const { filter: visibility } = await this.getVisibilityContext(currentUserId);

    // 2. Fallback to Direct AI Server Call (Realtime Inference)
    try {
      const responseAPIAi: AxiosResponse<{
        posts: { post_id: string; score: number }[];
        total: number;
      }> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/newsfeed/${currentUserId}`, {
          params: { limit, page },
          ...this.aiRequestConfig(10000),
        })
      );

      const postRelevantIds = responseAPIAi.data.posts.map((post) => post.post_id);
      const scoreMap = new Map(responseAPIAi.data.posts.map((p) => [p.post_id, p.score]));

      if (postRelevantIds.length > 0) {
        const dataPosts = await this.postModel
          .find({
            $and: [
              { _id: { $in: postRelevantIds }, isDeleted: false, isActive: true },
              visibility,
            ],
          })
          .populate('userId', 'firstName lastName avatar username')
          .populate('groupId', 'name avatar privacy')
          .populate({
            path: 'sharedPostId',
            match: { isDeleted: false },
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

        const filteredData = sortedPosts;

        // Add reactions info
        const postIds = filteredData.map((p) => p._id);
        const postIdStrings = postIds.map((id) => id.toString());

        const [userReactions, reactionsSummary] = await Promise.all([
          this.reactionService.userReactions(postIds, currentUserId),
          this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
    } catch (error: any) {
      this.logger.warn(`AI Server unavailable, falling back to standard newsfeed: ${error.message}`);
    }

    // Fallback: Standard MongoDB query (original logic)
    const skip = (page - 1) * limit;
    const filter = {
      $and: [{ isDeleted: false, isActive: true }, visibility],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          match: { isDeleted: false },
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const filteredData = data;

    const postIds = filteredData.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, currentUserId),
      this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
    keyword?: string
  ): Promise<any> {
    ({ page, limit } = this.clampPagination(page, limit));
    const { filter: visibility } = await this.getVisibilityContext(currentUserId);

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
            limit,
            page,
            apply_privacy_filter: true,
          },
          ...this.aiRequestConfig(30000),
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
        .find({
          $and: [
            { _id: { $in: postRelevantIds }, isDeleted: false, isActive: true },
            visibility,
          ],
        })
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          match: { isDeleted: false },
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

      const filteredData = sortedPosts;

      // Add reactions info
      const postIds = filteredData.map((p) => p._id);
      const postIdStrings = postIds.map((id) => id.toString());

      const [userReactions, reactionsSummary] = await Promise.all([
        this.reactionService.userReactions(postIds, currentUserId),
        this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
    } catch (error: any) {
      this.logger.error(`AI Server search failed: ${error.message}`);

      // Fallback: basic text search with MongoDB
      const skip = (page - 1) * limit;

      const filter = {
        $and: [
          { isDeleted: false, isActive: true, $text: { $search: keyword } },
          visibility,
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
              match: { isDeleted: false },
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
          this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
  /**
   * Get video reels - posts that contain VIDEO media type
   * Enhanced with AI recommendations
   */
  async findVideoReels(
    currentUserId: string,
    page = 1,
    limit = 10
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    ({ page, limit } = this.clampPagination(page, limit));
    const { filter: visibility } = await this.getVisibilityContext(currentUserId);

    // Try AI Server for personalization
    try {
      const responseAPIAi: AxiosResponse<{
        posts: { post_id: string; score: number }[];
        total: number;
      }> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/newsfeed/${currentUserId}`, {
          params: {
            limit, // Use requested limit directly as AI now filters by type
            page,
            media_type: 'VIDEO', // Request specific type
          },
          ...this.aiRequestConfig(30000),
        })
      );

      const postRelevantIds = responseAPIAi.data.posts.map((post) => post.post_id);
      const scoreMap = new Map(responseAPIAi.data.posts.map((p) => [p.post_id, p.score]));

      if (postRelevantIds.length > 0) {
        const dataPosts = await this.postModel
          .find({
            $and: [
              {
                _id: { $in: postRelevantIds },
                isDeleted: false,
                isActive: true,
                'media.mediaType': 'VIDEO',
              },
              visibility,
            ],
          })
          .populate('userId', 'firstName lastName avatar username')
          .populate('groupId', 'name avatar privacy')
          .populate({
            path: 'sharedPostId',
            match: { isDeleted: false },
            populate: { path: 'userId', select: 'firstName lastName avatar username' },
          })
          .lean()
          .exec();

        const postMap = new Map(dataPosts.map((post) => [post._id.toString(), post]));

        // Sort by AI score
        const sortedPosts = postRelevantIds
          .map((postId) => {
            const post = postMap.get(postId);
            if (!post) return null;
            return { ...post, aiScore: scoreMap.get(postId) || 0 };
          })
          .filter((post) => post !== null);

        const filteredData = sortedPosts;

        // Add reactions info
        const postIds = filteredData.map((p) => p._id);
        const postIdStrings = postIds.map((id) => id.toString());

        const [userReactions, reactionsSummary] = await Promise.all([
          this.reactionService.userReactions(postIds, currentUserId),
          this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
        ]);

        const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

        (filteredData as PostWithReactInfo[]).forEach((post) => {
          const postIdStr = post._id.toString();
          const r = reactionMap.get(postIdStr) as any;
          const summary = reactionsSummary[postIdStr];
          post.reactInfo = { isReact: !!r, type: r ? r.type : null };
          (post as any).topReactions = summary?.topReactions || [];
        });

        // If we found videos, return them.
        if (filteredData.length > 0) {
          return {
            data: filteredData as PostWithReactInfo[],
            total: responseAPIAi.data.total,
            page,
            totalPages: Math.ceil(responseAPIAi.data.total / limit),
          };
        }
      }
    } catch (error: any) {
      this.logger.warn(
        `AI Server unavailable for Reels, falling back to chronological: ${error.message}`
      );
    }

    // Fallback: Chronological Video Feed
    const skip = (page - 1) * limit;

    const filter = {
      $and: [
        { isDeleted: false, isActive: true, 'media.mediaType': 'VIDEO' },
        visibility,
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .populate({
          path: 'sharedPostId',
          match: { isDeleted: false },
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const filteredData = data;

    const postIds = filteredData.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    // Get user reactions and top reactions summary in parallel
    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, currentUserId),
      this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
      data: filteredData as PostWithReactInfo[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, currentUserId: string): Promise<Post> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid post identifier');
    }
    const visibility = await this.buildVisibilityFilter(currentUserId);
    const post = await this.postModel
      .findOne({
        $and: [
          { _id: new Types.ObjectId(id), isDeleted: false, isActive: true },
          visibility,
        ],
      })
      .populate('userId', 'firstName lastName avatar username')
      .populate('groupId', 'name avatar privacy')
      .populate({
        path: 'sharedPostId',
        match: { isDeleted: false },
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
    currentUserId?: string
  ): Promise<{ data: Post[]; total: number; page: number; totalPages: number }> {
    if (!currentUserId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid viewer or profile identifier');
    }
    ({ page, limit } = this.clampPagination(page, limit));
    const skip = (page - 1) * limit;
    const targetUserObjId = new Types.ObjectId(userId);
    const visibility = await this.buildVisibilityFilter(currentUserId);

    // Build privacy filter based on viewer:
    // 1. Own profile: see all posts
    // 2. Friend viewing: see PUBLIC + FRIEND posts
    // 3. Non-friend viewing: see PUBLIC posts only
    const privacyFilter: Record<string, unknown> = {
      $and: [
        { userId: targetUserObjId, isDeleted: false, isActive: true },
        visibility,
      ],
    };

    const [data, total] = await Promise.all([
      this.postModel
        .find(privacyFilter)
        .populate('userId', 'firstName lastName avatar username')
        .populate({
          path: 'sharedPostId',
          match: { isDeleted: false },
          populate: { path: 'userId', select: 'firstName lastName avatar username' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.postModel.countDocuments(privacyFilter),
    ]);

    const postIds = data.map((p) => p._id);
    const postIdStrings = postIds.map((id) => id.toString());

    const reactionViewerId = currentUserId;

    const [userReactions, reactionsSummary] = await Promise.all([
      this.reactionService.userReactions(postIds, reactionViewerId),
      this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, reactionViewerId),
    ]);

    const reactionMap = new Map(userReactions.map((r) => [r.factorId.toString(), r]));

    (data as PostWithReactInfo[]).forEach((post) => {
      const postIdStr = post._id.toString();
      const r = reactionMap.get(postIdStr) as any;
      const summary = reactionsSummary[postIdStr];

      post.reactInfo = { isReact: !!r, type: r ? r.type : null };
      (post as any).topReactions = summary?.topReactions || [];
    });

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updatePostDto: UpdatePostDto, currentUserId: string): Promise<Post> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Invalid post or user identifier');
    }
    const post = await this.postModel
      .findOne({
        _id: new Types.ObjectId(id),
        isDeleted: false,
      })
      .select('userId groupId media')
      .lean();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check ownership - handle both populated and non-populated userId
    const postOwnerId =
      typeof post.userId === 'object' && post.userId !== null
        ? (post.userId as any)._id?.toString() || (post.userId as any).toString()
        : String(post.userId);

    if (postOwnerId !== currentUserId) {
      throw new ForbiddenException('You can only edit your own posts');
    }
    if (post.groupId && !(await this.groupService.isMember(currentUserId, post.groupId.toString()))) {
      throw new ForbiddenException('You are no longer a member of this post group');
    }
    if (updatePostDto.media !== undefined) {
      const existingPublicIds = new Set((post.media || []).map((media) => media.publicId));
      const newlyAttachedMedia = updatePostDto.media.filter(
        (media) => !existingPublicIds.has(media.publicId),
      );
      await this.cloudinaryService.assertOwnedMedia(currentUserId, newlyAttachedMedia);
    }

    const safeUpdate: Record<string, unknown> = {};
    if (updatePostDto.content !== undefined) {
      safeUpdate.content = updatePostDto.content?.trim().slice(0, 10000) || '';
    }
    if (updatePostDto.media !== undefined) safeUpdate.media = updatePostDto.media;
    if (updatePostDto.background !== undefined) safeUpdate.background = updatePostDto.background;
    if (updatePostDto.allowComments !== undefined) {
      safeUpdate.allowComments = updatePostDto.allowComments;
    }
    if (updatePostDto.allowShares !== undefined) safeUpdate.allowShares = updatePostDto.allowShares;
    if (updatePostDto.allowReactions !== undefined) {
      safeUpdate.allowReactions = updatePostDto.allowReactions;
    }
    if (!post.groupId && updatePostDto.privacy !== undefined) {
      safeUpdate.privacy = updatePostDto.privacy;
    }
    if (Object.keys(safeUpdate).length === 0) {
      throw new BadRequestException('No supported post fields were provided');
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
        this.cloudinaryService.deleteOwnedMedia(currentUserId, mediaToDelete).catch((err) => {
          this.logger.error(`Failed to delete old media from Cloudinary: ${err?.message || err}`);
        });
      }
    }

    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, { $set: safeUpdate }, { new: true, runValidators: true })
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

    // Re-embed post to AI server if content changed
    if (updatePostDto.content !== undefined && updatedPost) {
      this.embedPostToAI(updatedPost).catch(() => {});
    }

    return updatedPost!;
  }

  async hidePost(postId: string, userId: string) {
    if (!(await this.canViewPost(postId, userId))) {
      throw new NotFoundException('Post not found');
    }

    // Emit to Kafka for AI scoring (POST_HIDE has weight -2.0)
    this.kafkaProducer
      .emitPostHide(userId, postId)
      .catch((err) => this.logger.warn(`Kafka hide event error: ${err?.message || err}`));

    return { message: 'Post hidden successfully' };
  }

  async remove(id: string, currentUserId: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(currentUserId)) {
      throw new BadRequestException('Invalid post or user identifier');
    }
    const post = await this.postModel
      .findOne({
        _id: new Types.ObjectId(id),
        isDeleted: false,
      })
      .select('userId media sharedPostId');

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId.toString() !== currentUserId) {
      throw new ForbiddenException('You can only delete your own posts');
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
        this.cloudinaryService.deleteOwnedMedia(currentUserId, mediaToDelete).catch((err) => {
          this.logger.error(`Failed to delete post media from Cloudinary: ${err?.message || err}`);
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

    if (post.sharedPostId) {
      await this.postModel.updateOne(
        { _id: post.sharedPostId, totalShares: { $gt: 0 } },
        { $inc: { totalShares: -1 } }
      );
    }

    this.deletePostEmbedding(id).catch(() => {});

    await this.notificationService.deactivateByPostRef(id);

    return { message: 'Post deleted successfully' };
  }

  // Helper methods for reactions/comments (can be expanded later)
  async incrementReacts(id: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: id, isDeleted: false, allowReactions: { $ne: false } },
      { $inc: { totalReacts: 1 } }
    );
  }

  async decrementReacts(id: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: id, totalReacts: { $gt: 0 } },
      { $inc: { totalReacts: -1 } }
    );
  }

  async incrementComments(id: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: id, isDeleted: false, allowComments: { $ne: false } },
      { $inc: { totalComments: 1 } }
    );
  }

  async incrementShares(id: string): Promise<void> {
    await this.postModel.updateOne(
      { _id: id, isDeleted: false, allowShares: { $ne: false } },
      { $inc: { totalShares: 1 } }
    );
  }

  // Get posts by group
  async findByGroupId(
    groupId: string,
    currentUserId: string,
    page = 1,
    limit = 10
  ): Promise<{ data: PostWithReactInfo[]; total: number; page: number; totalPages: number }> {
    if (
      !Types.ObjectId.isValid(groupId) ||
      !(await this.groupService.canViewGroupContent(currentUserId, groupId))
    ) {
      throw new ForbiddenException('You cannot view posts from this group');
    }
    ({ page, limit } = this.clampPagination(page, limit));
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
          match: { isDeleted: false },
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
      this.reactionService.getVisiblePostsReactionsSummary(postIdStrings, currentUserId),
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
