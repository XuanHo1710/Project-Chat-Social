import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument, StoryPrivacy } from './entities/story.entity';
import { CreateStoryDto, UpdateStoryDto } from './dto/story.dto';
import { Relationship, RelationshipDocument } from 'src/relationship/entities/relationship.entity';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(Relationship.name) private relationshipModel: Model<RelationshipDocument>
  ) {}

  /**
   * Create a new story
   */
  async create(userId: string, createStoryDto: CreateStoryDto): Promise<Story> {
    // Validate video duration
    if (
      createStoryDto.type === 'VIDEO' &&
      createStoryDto.duration &&
      createStoryDto.duration > 15
    ) {
      throw new ForbiddenException('Video duration cannot exceed 15 seconds');
    }

    const story = new this.storyModel({
      ...createStoryDto,
      userId: new Types.ObjectId(userId),
    });

    return story.save();
  }

  /**
   * Get stories from friends (for feed)
   */
  async getFriendsStories(userId: string): Promise<any[]> {
    // Get list of friends
    const friendships = await this.relationshipModel.find({
      $or: [
        { friendId: new Types.ObjectId(userId), status: 'ACCEPTED' },
        { userId: new Types.ObjectId(userId), status: 'ACCEPTED' },
      ],
    });

    const friendIds = friendships.map((f) =>
      f.userId.toString() === userId
        ? new Types.ObjectId(f.friendId.toString())
        : new Types.ObjectId(f.userId.toString())
    );

    // Add self to see own stories
    friendIds.push(new Types.ObjectId(userId));

    // Get active stories (not expired, not deleted)
    const stories = await this.storyModel.aggregate([
      {
        $match: {
          userId: { $in: friendIds },
          isDeleted: false,
          expiresAt: { $gt: new Date() },
          $or: [
            { privacy: StoryPrivacy.PUBLIC },
            { privacy: StoryPrivacy.FRIENDS },
            { userId: new Types.ObjectId(userId) }, // Always show own stories
          ],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      // Add viewCount to each story
      {
        $addFields: {
          viewCount: { $size: '$viewers' },
        },
      },
      {
        $group: {
          _id: '$userId',
          stories: { $push: '$$ROOT' },
          latestStory: { $first: '$$ROOT' },
        },
      },
      {
        $lookup: {
          from: 'accounts',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          _id: 1,
          user: {
            _id: 1,
            firstName: 1,
            lastName: 1,
            avatar: 1,
          },
          stories: 1,
          latestStory: 1,
          hasUnviewed: {
            $anyElementTrue: {
              $map: {
                input: '$stories',
                as: 'story',
                in: {
                  $not: {
                    $in: [
                      new Types.ObjectId(userId),
                      {
                        $map: {
                          input: '$$story.viewers',
                          as: 'v',
                          in: '$$v.userId',
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $sort: {
          // Own stories first, then unviewed, then by latest
          _id: userId === '$_id' ? -1 : 1,
          hasUnviewed: -1,
          'latestStory.createdAt': -1,
        },
      },
    ]);

    // Sort: own stories first
    stories.sort((a, b) => {
      if (a._id.toString() === userId) return -1;
      if (b._id.toString() === userId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return (
        new Date(b.latestStory.createdAt).getTime() - new Date(a.latestStory.createdAt).getTime()
      );
    });

    return stories;
  }

  /**
   * Get user's own stories
   */
  async getMyStories(userId: string): Promise<Story[]> {
    return this.storyModel
      .find({
        userId: new Types.ObjectId(userId),
        isDeleted: false,
        expiresAt: { $gt: new Date() },
      })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Get a single story by ID
   */
  async getStoryById(storyId: string, viewerId: string): Promise<Story> {
    const story = await this.storyModel
      .findById(storyId)
      .populate('userId', 'firstName lastName avatar')
      .lean();

    if (!story || story.isDeleted) {
      throw new NotFoundException('Story not found');
    }

    // Check if expired
    if (new Date(story.expiresAt) < new Date()) {
      throw new NotFoundException('Story has expired');
    }

    // Check privacy
    if (story.privacy === StoryPrivacy.FRIENDS && story.userId.toString() !== viewerId) {
      const isFriend = await this.relationshipModel.exists({
        $or: [
          { senderId: story.userId, receiverId: new Types.ObjectId(viewerId), status: 'ACCEPTED' },
          { senderId: new Types.ObjectId(viewerId), receiverId: story.userId, status: 'ACCEPTED' },
        ],
      });
      if (!isFriend) {
        throw new ForbiddenException('You cannot view this story');
      }
    }

    return story;
  }

  /**
   * Mark story as viewed
   */
  async viewStory(storyId: string, viewerId: string): Promise<void> {
    try {
      const story = await this.storyModel.findById(storyId);
      if (!story) return;

      // Don't track own views
      if (story.userId.toString() === viewerId) return;

      // Check if already viewed - handle both old (ObjectId) and new ({userId, viewedAt}) format
      const alreadyViewed = story.viewers.some((v) => {
        if (typeof v === 'object' && v.userId) {
          return v.userId.toString() === viewerId;
        }
        return v.toString() === viewerId;
      });

      if (!alreadyViewed) {
        await this.storyModel.findByIdAndUpdate(storyId, {
          $push: {
            viewers: {
              userId: new Types.ObjectId(viewerId),
              viewedAt: new Date(),
            },
          },
        });
      }
    } catch (error) {
      console.error('Error in viewStory:', error);
      // Don't throw - viewing is not critical
    }
  }

  /**
   * React to a story
   */
  async reactToStory(storyId: string, userId: string, reaction: string): Promise<Story> {
    const story = await this.storyModel.findById(storyId);
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    // Remove existing reaction from this user
    story.reactions = story.reactions.filter((r) => r.userId.toString() !== userId);

    // Add new reaction
    story.reactions.push({
      userId: new Types.ObjectId(userId),
      reaction,
      createdAt: new Date(),
    });

    return story.save();
  }

  /**
   * Update a story (caption, privacy, captionStyle)
   */
  async updateStory(storyId: string, userId: string, updateDto: UpdateStoryDto): Promise<Story> {
    const story = await this.storyModel.findById(storyId);
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own stories');
    }

    Object.assign(story, updateDto);
    return story.save();
  }

  /**
   * Delete a story
   */
  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await this.storyModel.findById(storyId);
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own stories');
    }

    story.isDeleted = true;
    await story.save();
  }

  /**
   * Get story viewers with their reactions
   */
  async getStoryViewers(
    storyId: string,
    userId: string
  ): Promise<{ viewers: any[]; totalViews: number }> {
    const story = await this.storyModel.findById(storyId).lean();

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.userId.toString() !== userId) {
      throw new ForbiddenException('You can only view viewers of your own stories');
    }

    // Handle empty viewers
    if (!story.viewers || story.viewers.length === 0) {
      return { viewers: [], totalViews: 0 };
    }

    // Check if viewers are in old format (ObjectId) or new format ({userId, viewedAt})
    const isOldFormat = story.viewers.length > 0 && !story.viewers[0].userId;

    if (isOldFormat) {
      // Old format: viewers are just ObjectIds
      const viewerIds = story.viewers.map((v) => new Types.ObjectId(v.toString()));
      const viewerAccounts = await this.storyModel.db
        .collection('accounts')
        .find({ _id: { $in: viewerIds } })
        .project({ _id: 1, firstName: 1, lastName: 1, avatar: 1 })
        .toArray();

      const reactionsMap = new Map(story.reactions.map((r) => [r.userId.toString(), r.reaction]));

      const viewers = viewerAccounts.map((acc) => ({
        userId: acc._id,
        viewedAt: new Date(),
        user: {
          _id: acc._id,
          firstName: acc.firstName,
          lastName: acc.lastName,
          avatar: acc.avatar,
        },
        reaction: reactionsMap.get(acc._id.toString()) || null,
      }));

      return { viewers, totalViews: story.viewers.length };
    }

    // New format: viewers have {userId, viewedAt}
    const viewersWithDetails = await this.storyModel.aggregate([
      { $match: { _id: new Types.ObjectId(storyId) } },
      { $unwind: '$viewers' },
      {
        $lookup: {
          from: 'accounts',
          localField: 'viewers.userId',
          foreignField: '_id',
          as: 'viewerInfo',
        },
      },
      { $unwind: { path: '$viewerInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: '$viewers.userId',
          viewedAt: '$viewers.viewedAt',
          user: {
            _id: '$viewerInfo._id',
            firstName: '$viewerInfo.firstName',
            lastName: '$viewerInfo.lastName',
            avatar: '$viewerInfo.avatar',
          },
        },
      },
      { $sort: { viewedAt: -1 } },
    ]);

    // Add reactions to each viewer
    const reactionsMap = new Map(story.reactions.map((r) => [r.userId.toString(), r.reaction]));

    const viewers = viewersWithDetails.map((viewer) => ({
      ...viewer,
      reaction: reactionsMap.get(viewer.userId?.toString()) || null,
    }));

    return {
      viewers,
      totalViews: story.viewers.length,
    };
  }

  /**
   * Get story reactions
   */
  async getStoryReactions(storyId: string): Promise<any[]> {
    const story = await this.storyModel
      .findById(storyId)
      .populate('reactions.userId', 'firstName lastName avatar')
      .lean();

    if (!story) {
      throw new NotFoundException('Story not found');
    }

    return story.reactions;
  }
}
