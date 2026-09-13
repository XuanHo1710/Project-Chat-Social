import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { GroupService } from 'src/group/group.service';
import { RelationshipService } from 'src/relationship/relationship.service';
import {
  LivestreamStatus,
  Post,
  PostDocument,
  PostPrivacy,
  PostType,
} from './entities/post.entity';

export interface PostVisibilityContext {
  filter: Record<string, unknown>;
  friendIds: string[];
  accessibleGroupIds: string[];
}

@Injectable()
export class PostAccessService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly relationshipService: RelationshipService,
    private readonly groupService: GroupService
  ) {}

  async getVisibilityContext(currentUserId: string): Promise<PostVisibilityContext> {
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

    return {
      friendIds,
      accessibleGroupIds,
      filter: {
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
      },
    };
  }

  async buildVisibilityFilter(currentUserId: string): Promise<Record<string, unknown>> {
    return (await this.getVisibilityContext(currentUserId)).filter;
  }

  async canViewPost(postId: string, currentUserId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(postId) || !Types.ObjectId.isValid(currentUserId)) return false;
    const visibility = await this.buildVisibilityFilter(currentUserId);
    const post = await this.postModel.exists({
      _id: new Types.ObjectId(postId),
      isDeleted: false,
      isActive: true,
      ...visibility,
    });
    return !!post;
  }

  async assertCanViewPost(postId: string, currentUserId: string): Promise<void> {
    if (!(await this.canViewPost(postId, currentUserId))) {
      throw new ForbiddenException('You cannot access this post');
    }
  }

  async filterAccessiblePostIds(postIds: string[], currentUserId: string): Promise<string[]> {
    const validIds = Array.from(new Set(postIds)).filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];
    const visibility = await this.buildVisibilityFilter(currentUserId);
    const posts = await this.postModel
      .find({
        $and: [
          {
            _id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
            isDeleted: false,
            isActive: true,
          },
          visibility,
        ],
      })
      .select('_id')
      .lean();
    return posts.map((post) => post._id.toString());
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
            type: PostType.LIVESTREAM,
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
}
