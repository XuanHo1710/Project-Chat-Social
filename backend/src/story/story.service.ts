import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RelationshipStatus } from 'src/relationship/entities/relationship.entity';
import { RelationshipService } from 'src/relationship/relationship.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CreateStoryDto, StoryCaptionStyleDto, UpdateStoryDto } from './dto/story.dto';
import { Story, StoryDocument, StoryPrivacy, StoryType } from './entities/story.entity';

type StoryRecord = Story & { _id: Types.ObjectId };

interface StoryViewerAccount {
  _id: Types.ObjectId;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  status?: string;
}

export interface StoryViewerDetails {
  userId: Types.ObjectId;
  viewedAt: Date;
  user: StoryViewerAccount | null;
  reaction: string | null;
}

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private readonly storyModel: Model<StoryDocument>,
    private readonly relationshipService: RelationshipService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  private toObjectId(value: string, fieldName: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }
    return new Types.ObjectId(value);
  }

  private optionalObjectId(value: unknown): Types.ObjectId | null {
    if (value instanceof Types.ObjectId) return value;
    if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
      return new Types.ObjectId(value);
    }
    return null;
  }

  private getOwnerId(story: { userId: unknown }): string {
    const owner = story.userId;
    if (owner instanceof Types.ObjectId) return owner.toHexString();
    if (typeof owner === 'string') return owner;
    if (!owner || typeof owner !== 'object' || !('_id' in owner)) return '';
    const populatedId = owner._id;
    if (populatedId instanceof Types.ObjectId) return populatedId.toHexString();
    return typeof populatedId === 'string' ? populatedId : '';
  }

  private normalizeCaptionStyle(style: StoryCaptionStyleDto): StoryCaptionStyleDto {
    return {
      x: style.x,
      y: style.y,
      ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
      ...(style.color !== undefined ? { color: style.color } : {}),
      ...(style.backgroundColor !== undefined ? { backgroundColor: style.backgroundColor } : {}),
    };
  }

  private async findActiveStory(storyId: string): Promise<StoryRecord> {
    const _id = this.toObjectId(storyId, 'storyId');
    const story = await this.storyModel
      .findOne({
        _id,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .lean<StoryRecord>();

    if (!story) {
      throw new NotFoundException('Story not found');
    }
    return story;
  }

  private async assertCanViewStory(story: StoryRecord, viewerId: string): Promise<void> {
    this.toObjectId(viewerId, 'viewerId');
    const ownerId = this.getOwnerId(story);
    if (ownerId === viewerId) return;

    if (story.privacy === StoryPrivacy.PRIVATE || story.privacy === StoryPrivacy.CUSTOM) {
      throw new ForbiddenException('You cannot view this story');
    }

    const relationship = await this.relationshipService.checkFriendship(ownerId, viewerId);
    if (relationship.status === RelationshipStatus.BLOCKED) {
      throw new ForbiddenException('You cannot view this story');
    }
    if (story.privacy === StoryPrivacy.FRIENDS && !relationship.isFriend) {
      throw new ForbiddenException('You cannot view this story');
    }
  }

  private sanitizeStory<T extends Record<string, any>>(story: T, includeEngagement: boolean): T {
    const viewers = Array.isArray(story.viewers) ? story.viewers : [];
    const plainStory = {
      ...story,
      viewCount: viewers.length,
    };

    if (includeEngagement) return plainStory;
    return {
      ...plainStory,
      viewers: [],
      reactions: [],
    };
  }

  async create(userId: string, createStoryDto: CreateStoryDto): Promise<Story> {
    const ownerId = this.toObjectId(userId, 'userId');
    const mediaUrl = createStoryDto.mediaUrl.trim();
    if (!mediaUrl) throw new BadRequestException('mediaUrl is required');
    if (!!createStoryDto.thumbnail !== !!createStoryDto.thumbnailPublicId) {
      throw new BadRequestException('thumbnail and thumbnailPublicId must be provided together');
    }
    if (
      createStoryDto.type === StoryType.VIDEO &&
      createStoryDto.duration !== undefined &&
      createStoryDto.duration > 15
    ) {
      throw new BadRequestException('Video duration cannot exceed 15 seconds');
    }

    await this.cloudinaryService.assertOwnedMedia(userId, [
      {
        publicId: createStoryDto.mediaPublicId.trim(),
        url: mediaUrl,
        mediaType: createStoryDto.type,
      },
      ...(createStoryDto.thumbnail && createStoryDto.thumbnailPublicId
        ? [
            {
              publicId: createStoryDto.thumbnailPublicId.trim(),
              url: createStoryDto.thumbnail.trim(),
              mediaType: 'IMAGE' as const,
            },
          ]
        : []),
    ]);

    const story = new this.storyModel({
      userId: ownerId,
      type: createStoryDto.type,
      mediaUrl,
      mediaPublicId: createStoryDto.mediaPublicId.trim(),
      privacy: createStoryDto.privacy ?? StoryPrivacy.FRIENDS,
      ...(createStoryDto.thumbnail ? { thumbnail: createStoryDto.thumbnail.trim() } : {}),
      ...(createStoryDto.thumbnailPublicId
        ? { thumbnailPublicId: createStoryDto.thumbnailPublicId.trim() }
        : {}),
      ...(createStoryDto.type === StoryType.VIDEO && createStoryDto.duration !== undefined
        ? { duration: createStoryDto.duration }
        : {}),
      ...(createStoryDto.caption !== undefined ? { caption: createStoryDto.caption.trim() } : {}),
      ...(createStoryDto.captionStyle
        ? { captionStyle: this.normalizeCaptionStyle(createStoryDto.captionStyle) }
        : {}),
    });

    return story.save();
  }

  async getFriendsStories(userId: string): Promise<unknown[]> {
    const viewerObjectId = this.toObjectId(userId, 'userId');
    const [friendIdStrings, relationshipFilters] = await Promise.all([
      this.relationshipService.getAcceptedFriendIdStrings(userId),
      this.relationshipService.getRelationshipFilters(userId),
    ]);
    const ownerIds = [userId, ...friendIdStrings]
      .filter((id, index, ids) => ids.indexOf(id) === index)
      .filter((id) => id === userId || !relationshipFilters.blockedUserIds.has(id))
      .map((id) => new Types.ObjectId(id));

    return this.storyModel.aggregate([
      {
        $match: {
          userId: { $in: ownerIds },
          isDeleted: false,
          expiresAt: { $gt: new Date() },
          $or: [
            { userId: viewerObjectId },
            { privacy: StoryPrivacy.PUBLIC },
            { privacy: StoryPrivacy.FRIENDS },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $set: {
          viewCount: { $size: { $ifNull: ['$viewers', []] } },
          isOwnStory: { $eq: ['$userId', viewerObjectId] },
          hasViewed: {
            $in: [
              viewerObjectId,
              {
                $map: {
                  input: { $ifNull: ['$viewers', []] },
                  as: 'viewer',
                  in: { $ifNull: ['$$viewer.userId', '$$viewer'] },
                },
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$userId',
          stories: {
            $push: {
              _id: '$_id',
              userId: '$userId',
              type: '$type',
              mediaUrl: '$mediaUrl',
              mediaPublicId: '$mediaPublicId',
              thumbnail: '$thumbnail',
              thumbnailPublicId: '$thumbnailPublicId',
              duration: '$duration',
              caption: '$caption',
              captionStyle: '$captionStyle',
              privacy: '$privacy',
              viewCount: '$viewCount',
              createdAt: '$createdAt',
              expiresAt: '$expiresAt',
              isArchived: '$isArchived',
              isDeleted: '$isDeleted',
              viewers: { $literal: [] },
              reactions: { $literal: [] },
            },
          },
          hasUnviewedValue: {
            $max: {
              $cond: [{ $or: ['$isOwnStory', '$hasViewed'] }, 0, 1],
            },
          },
          isOwnGroup: { $max: { $cond: ['$isOwnStory', 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'accounts',
          let: { ownerId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$ownerId'] },
                isActive: { $ne: false },
              },
            },
            { $project: { _id: 1, firstName: 1, lastName: 1, avatar: 1 } },
          ],
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $set: {
          latestStory: { $arrayElemAt: ['$stories', 0] },
          hasUnviewed: { $eq: ['$hasUnviewedValue', 1] },
        },
      },
      { $sort: { isOwnGroup: -1, hasUnviewed: -1, 'latestStory.createdAt': -1 } },
      {
        $project: {
          _id: 1,
          user: 1,
          stories: 1,
          latestStory: 1,
          hasUnviewed: 1,
        },
      },
    ]);
  }

  async getMyStories(userId: string): Promise<Story[]> {
    const ownerId = this.toObjectId(userId, 'userId');
    const stories = await this.storyModel
      .find({
        userId: ownerId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .lean();

    return stories.map((story) => this.sanitizeStory(story, true)) as Story[];
  }

  async getStoryById(storyId: string, viewerId: string): Promise<Story> {
    const story = await this.findActiveStory(storyId);
    await this.assertCanViewStory(story, viewerId);
    const populatedStory = await this.storyModel
      .findById(story._id)
      .populate('userId', 'firstName lastName avatar')
      .lean();

    if (!populatedStory) {
      throw new NotFoundException('Story not found');
    }
    return this.sanitizeStory(
      populatedStory,
      this.getOwnerId(populatedStory) === viewerId
    ) as Story;
  }

  async viewStory(storyId: string, viewerId: string): Promise<void> {
    const viewerObjectId = this.toObjectId(viewerId, 'viewerId');
    const story = await this.findActiveStory(storyId);
    await this.assertCanViewStory(story, viewerId);
    if (this.getOwnerId(story) === viewerId) return;

    const now = new Date();
    await this.storyModel.updateOne(
      {
        _id: story._id,
        userId: story.userId,
        privacy: story.privacy,
        isDeleted: false,
        expiresAt: { $gt: now },
        viewers: { $ne: viewerObjectId },
        'viewers.userId': { $ne: viewerObjectId },
      },
      [
        {
          $set: {
            viewers: {
              $slice: [
                {
                  $cond: [
                    {
                      $in: [
                        viewerObjectId,
                        {
                          $map: {
                            input: { $ifNull: ['$viewers', []] },
                            as: 'viewer',
                            in: { $ifNull: ['$$viewer.userId', '$$viewer'] },
                          },
                        },
                      ],
                    },
                    { $ifNull: ['$viewers', []] },
                    {
                      $concatArrays: [
                        { $ifNull: ['$viewers', []] },
                        [{ userId: viewerObjectId, viewedAt: now }],
                      ],
                    },
                  ],
                },
                -200,
              ],
            },
          },
        },
      ]
    );
  }

  async reactToStory(storyId: string, userId: string, reaction: string): Promise<Story> {
    const reactorObjectId = this.toObjectId(userId, 'userId');
    const story = await this.findActiveStory(storyId);
    await this.assertCanViewStory(story, userId);
    if (this.getOwnerId(story) === userId) {
      throw new ForbiddenException('You cannot react to your own story');
    }

    const now = new Date();
    const updatedStory = await this.storyModel.findOneAndUpdate(
      {
        _id: story._id,
        userId: story.userId,
        privacy: story.privacy,
        isDeleted: false,
        expiresAt: { $gt: now },
      },
      [
        {
          $set: {
            viewers: {
              $slice: [
                {
                  $cond: [
                    {
                      $in: [
                        reactorObjectId,
                        {
                          $map: {
                            input: { $ifNull: ['$viewers', []] },
                            as: 'viewer',
                            in: { $ifNull: ['$$viewer.userId', '$$viewer'] },
                          },
                        },
                      ],
                    },
                    { $ifNull: ['$viewers', []] },
                    {
                      $concatArrays: [
                        { $ifNull: ['$viewers', []] },
                        [{ userId: reactorObjectId, viewedAt: now }],
                      ],
                    },
                  ],
                },
                -200,
              ],
            },
            reactions: {
              $slice: [
                {
                  $concatArrays: [
                    {
                      $filter: {
                        input: { $ifNull: ['$reactions', []] },
                        as: 'existingReaction',
                        cond: { $ne: ['$$existingReaction.userId', reactorObjectId] },
                      },
                    },
                    [{ userId: reactorObjectId, reaction, createdAt: now }],
                  ],
                },
                -200,
              ],
            },
          },
        },
      ],
      { new: true, runValidators: true }
    );

    if (!updatedStory) {
      throw new NotFoundException('Story is no longer available');
    }
    return this.sanitizeStory(updatedStory.toObject(), false) as Story;
  }

  async updateStory(storyId: string, userId: string, updateDto: UpdateStoryDto): Promise<Story> {
    const _id = this.toObjectId(storyId, 'storyId');
    const ownerId = this.toObjectId(userId, 'userId');
    const updates: Record<string, unknown> = {};
    if (updateDto.caption !== undefined) updates.caption = updateDto.caption.trim();
    if (updateDto.privacy !== undefined) updates.privacy = updateDto.privacy;
    if (updateDto.captionStyle !== undefined) {
      updates.captionStyle = updateDto.captionStyle
        ? this.normalizeCaptionStyle(updateDto.captionStyle)
        : null;
    }

    const story = await this.storyModel.findOneAndUpdate(
      {
        _id,
        userId: ownerId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    return story;
  }

  async deleteStory(storyId: string, userId: string): Promise<void> {
    const _id = this.toObjectId(storyId, 'storyId');
    const ownerId = this.toObjectId(userId, 'userId');
    const result = await this.storyModel.updateOne(
      {
        _id,
        userId: ownerId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      },
      { $set: { isDeleted: true } }
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('Story not found');
    }
  }

  async getStoryViewers(
    storyId: string,
    userId: string
  ): Promise<{ viewers: StoryViewerDetails[]; totalViews: number }> {
    const story = await this.findActiveStory(storyId);
    if (this.getOwnerId(story) !== userId) {
      throw new ForbiddenException('You can only view viewers of your own stories');
    }

    const normalizedViewers = ((story.viewers as unknown[] | undefined) ?? []).reduce<
      { userId: Types.ObjectId; viewedAt: Date }[]
    >((result, viewer) => {
      const embeddedViewer =
        viewer && typeof viewer === 'object'
          ? (viewer as { userId?: unknown; viewedAt?: unknown })
          : null;
      const viewerObjectId = this.optionalObjectId(embeddedViewer?.userId ?? viewer);
      if (!viewerObjectId) return result;
      result.push({
        userId: viewerObjectId,
        viewedAt:
          embeddedViewer?.viewedAt instanceof Date
            ? embeddedViewer.viewedAt
            : typeof embeddedViewer?.viewedAt === 'string' ||
                typeof embeddedViewer?.viewedAt === 'number'
              ? new Date(embeddedViewer.viewedAt)
              : story.createdAt,
      });
      return result;
    }, []);
    const uniqueViewers = new Map<string, { userId: Types.ObjectId; viewedAt: Date }>();
    for (const viewer of normalizedViewers) {
      const key = viewer.userId.toString();
      const current = uniqueViewers.get(key);
      if (!current || viewer.viewedAt > current.viewedAt) uniqueViewers.set(key, viewer);
    }
    if (uniqueViewers.size === 0) return { viewers: [], totalViews: 0 };

    const viewerAccounts = await this.storyModel.db
      .collection<StoryViewerAccount>('accounts')
      .find({ _id: { $in: [...uniqueViewers.values()].map((viewer) => viewer.userId) } })
      .project<StoryViewerAccount>({
        _id: 1,
        firstName: 1,
        lastName: 1,
        avatar: 1,
        status: 1,
      })
      .toArray();
    const accountById = new Map(viewerAccounts.map((account) => [account._id.toString(), account]));
    const reactionByUserId = new Map(
      (story.reactions ?? []).map((reaction) => [reaction.userId.toString(), reaction.reaction])
    );
    const viewers = [...uniqueViewers.values()]
      .sort((left, right) => right.viewedAt.getTime() - left.viewedAt.getTime())
      .map((viewer) => {
        const account = accountById.get(viewer.userId.toString());
        return {
          userId: viewer.userId,
          viewedAt: viewer.viewedAt,
          user: account
            ? {
                _id: account._id,
                firstName: account.firstName,
                lastName: account.lastName,
                avatar: account.avatar,
                status: account.status,
              }
            : null,
          reaction: reactionByUserId.get(viewer.userId.toString()) ?? null,
        };
      });

    return { viewers, totalViews: uniqueViewers.size };
  }

  async getStoryReactions(storyId: string, userId: string): Promise<unknown[]> {
    const _id = this.toObjectId(storyId, 'storyId');
    const ownerId = this.toObjectId(userId, 'userId');
    const story = await this.storyModel
      .findOne({
        _id,
        userId: ownerId,
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .select('reactions')
      .populate('reactions.userId', 'firstName lastName avatar status')
      .lean();

    if (!story) {
      throw new NotFoundException('Story not found');
    }
    return story.reactions ?? [];
  }
}
