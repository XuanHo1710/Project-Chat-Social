import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../account/entities/account.entity';
import { Comment, CommentDocument } from '../comment/entities/comment.entity';
import { Post, PostDocument } from '../post/entities/post.entity';
import { Reaction, ReactionDocument } from '../reaction/entities/reaction.entity';
import {
  AdminPostQueryDto,
  AdminUserQueryDto,
  CreateAdminAccountDto,
} from './dto/admin.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    @InjectModel(Reaction.name) private readonly reactionModel: Model<ReactionDocument>,
  ) {}

  private objectId(id: string, label = 'ID'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException(`${label} không hợp lệ`);
    return new Types.ObjectId(id);
  }

  private isBlockActive(account: Record<string, any>): boolean {
    return (
      account.isBlocked === true &&
      (!account.expireBlockAt || new Date(account.expireBlockAt).getTime() > Date.now())
    );
  }

  private mapAdminUser(user: Record<string, any>) {
    return {
      id: user._id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      email: user.email || '',
      avatar: user.avatar,
      role: user.role,
      status: this.isBlockActive(user) ? 'BLOCKED' : user.isActive ? 'ACTIVE' : 'PENDING',
      lastLogin: user.lastLogin || null,
      createdAt: user.createdAt,
      isBlocked: this.isBlockActive(user),
      expireBlockAt: user.expireBlockAt || null,
      blockReason: user.blockReason || '',
      phone: user.phone || '',
      username: user.username || '',
    };
  }

  private async assertNotLastActiveAdmin(target: Record<string, any>): Promise<void> {
    if (
      target.role !== UserRole.ADMIN ||
      target.isDeleted ||
      !target.isActive ||
      this.isBlockActive(target)
    ) {
      return;
    }
    const activeAdminCount = await this.accountModel.countDocuments({
      role: UserRole.ADMIN,
      isDeleted: { $ne: true },
      isActive: true,
      $or: [
        { isBlocked: { $ne: true } },
        { expireBlockAt: { $lte: new Date() } },
      ],
    });
    if (activeAdminCount <= 1) {
      throw new ConflictException('Không thể vô hiệu hóa quản trị viên hoạt động cuối cùng');
    }
  }

  async getDashboardStats(): Promise<Record<string, number>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      onlineUsers,
      totalPosts,
      newPostsToday,
      totalComments,
      totalReactions,
      usersYesterday,
    ] = await Promise.all([
      this.accountModel.countDocuments({ isDeleted: { $ne: true }, role: { $ne: UserRole.BOT } }),
      this.accountModel.countDocuments({
        createdAt: { $gte: today },
        isDeleted: { $ne: true },
        role: { $ne: UserRole.BOT },
      }),
      this.accountModel.countDocuments({
        status: 'ACTIVE',
        lastActive: { $gte: fiveMinutesAgo },
        isDeleted: { $ne: true },
      }),
      this.postModel.countDocuments({ isDeleted: { $ne: true } }),
      this.postModel.countDocuments({ createdAt: { $gte: today }, isDeleted: { $ne: true } }),
      this.commentModel.countDocuments({ isActive: true }),
      this.reactionModel.countDocuments({}),
      this.accountModel.countDocuments({
        createdAt: { $gte: yesterday, $lt: today },
        isDeleted: { $ne: true },
        role: { $ne: UserRole.BOT },
      }),
    ]);

    const userChange =
      usersYesterday > 0
        ? Math.round(((newUsersToday - usersYesterday) / usersYesterday) * 100)
        : newUsersToday > 0
          ? 100
          : 0;
    return {
      totalUsers,
      newUsersToday,
      userChange,
      onlineUsers,
      totalPosts,
      newPostsToday,
      totalComments,
      totalReactions,
    };
  }

  async getWeeklyPostsStats(): Promise<Array<{ day: string; count: number }>> {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const stats = await this.postModel.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end }, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]);
    const countByDate = new Map(stats.map((row) => [row._id, row.count]));
    const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return Array.from({ length: 7 }, (_, offset) => {
      const date = new Date(start);
      date.setDate(start.getDate() + offset);
      const key = date.toISOString().slice(0, 10);
      return { day: labels[date.getDay()], count: countByDate.get(key) || 0 };
    });
  }

  async getTopPagesStats(): Promise<never[]> {
    // Page-view tracking is not implemented; do not return fabricated production metrics.
    return [];
  }

  async getRecentComments(): Promise<any[]> {
    const comments = await this.commentModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName avatar')
      .lean();
    return comments.map((comment) => ({
      id: comment._id,
      user: comment.userId
        ? `${(comment.userId as any).firstName || ''} ${(comment.userId as any).lastName || ''}`.trim()
        : 'Anonymous',
      avatar: (comment.userId as any)?.avatar || '',
      content: comment.content,
      time: this.getTimeAgo(comment.createdAt),
    }));
  }

  async getEmotionStats(): Promise<any[]> {
    const emotions = await this.reactionModel.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    const total = emotions.reduce((sum, emotion) => sum + emotion.count, 0);
    const emotionMap: Record<string, { label: string; color: string }> = {
      LIKE: { label: 'Like', color: '#1877f2' },
      LOVE: { label: 'Love', color: '#f23e5c' },
      HAHA: { label: 'Haha', color: '#f7b928' },
      WOW: { label: 'Wow', color: '#f7b928' },
      SAD: { label: 'Sad', color: '#f7b928' },
      ANGRY: { label: 'Angry', color: '#e9710f' },
    };
    return emotions.map((emotion) => ({
      type: emotion._id,
      label: emotionMap[emotion._id]?.label || emotion._id,
      count: emotion.count,
      percentage: total > 0 ? Math.round((emotion.count / total) * 100) : 0,
      color: emotionMap[emotion._id]?.color || '#65676b',
    }));
  }

  async getUsers(query: AdminUserQueryDto): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const filter: Record<string, any> = { isDeleted: { $ne: true }, role: { $ne: UserRole.BOT } };
    const now = new Date();

    if (query.status === 'ACTIVE') {
      filter.isActive = true;
      filter.$or = [{ isBlocked: { $ne: true } }, { expireBlockAt: { $lte: now } }];
    } else if (query.status === 'BLOCKED') {
      filter.isBlocked = true;
      filter.$or = [{ expireBlockAt: null }, { expireBlockAt: { $gt: now } }];
    } else if (query.status === 'PENDING') {
      filter.isActive = false;
    }
    if (query.role && query.role !== 'ALL') filter.role = query.role;
    if (query.search) filter.$text = { $search: query.search };

    const sortMapping: Record<string, string> = {
      lastLogin: 'lastLogin',
      email: 'email',
      name: 'firstName',
      createdAt: 'createdAt',
    };
    const sortField = sortMapping[query.sortBy || ''] || 'createdAt';
    const sort = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;
    const projection =
      '_id firstName lastName email phone username avatar role isActive isBlocked expireBlockAt blockReason lastLogin createdAt';
    const [users, total] = await Promise.all([
      this.accountModel
        .find(filter)
        .select(projection)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.accountModel.countDocuments(filter),
    ]);
    return {
      data: users.map((user) => this.mapAdminUser(user as any)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserById(id: string): Promise<any> {
    const user = await this.accountModel
      .findById(this.objectId(id, 'User ID'))
      .select(
        '_id firstName lastName email phone username avatar role isActive isBlocked expireBlockAt blockReason lastLogin createdAt',
      )
      .lean();
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return this.mapAdminUser(user as any);
  }

  async blockUser(
    actorId: string,
    targetId: string,
    reason?: string,
    expireAt?: Date,
  ): Promise<any> {
    if (actorId === targetId) throw new ForbiddenException('Bạn không thể tự khóa tài khoản của mình');
    if (expireAt && expireAt.getTime() <= Date.now()) {
      throw new BadRequestException('Thời điểm hết hạn khóa phải ở tương lai');
    }
    const targetObjectId = this.objectId(targetId, 'User ID');
    const target = await this.accountModel
      .findById(targetObjectId)
      .select('role isActive isBlocked expireBlockAt isDeleted')
      .lean();
    if (!target || target.isDeleted) throw new NotFoundException('Không tìm thấy tài khoản');
    await this.assertNotLastActiveAdmin(target as any);

    const updated = await this.accountModel
      .findByIdAndUpdate(
        targetObjectId,
        {
          $set: {
            isBlocked: true,
            blockedAt: new Date(),
            blockReason: reason?.trim() || '',
            expireBlockAt: expireAt || null,
          },
          $inc: { authVersion: 1 },
        },
        { new: true, runValidators: true },
      )
      .select(
        '_id firstName lastName email phone username avatar role isActive isBlocked expireBlockAt blockReason lastLogin createdAt',
      )
      .lean();
    return this.mapAdminUser(updated as any);
  }

  async unblockUser(id: string): Promise<any> {
    const updated = await this.accountModel
      .findOneAndUpdate(
        { _id: this.objectId(id, 'User ID'), isDeleted: { $ne: true } },
        {
          $set: { isBlocked: false, expireBlockAt: null, blockReason: '' },
          $inc: { authVersion: 1 },
        },
        { new: true },
      )
      .select(
        '_id firstName lastName email phone username avatar role isActive isBlocked expireBlockAt blockReason lastLogin createdAt',
      )
      .lean();
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    return this.mapAdminUser(updated as any);
  }

  async updateUserRole(
    actorId: string,
    targetId: string,
    role: UserRole.USER | UserRole.ADMIN | UserRole.EMPLOYEE,
  ): Promise<any> {
    if (actorId === targetId && role !== UserRole.ADMIN) {
      throw new ForbiddenException('Bạn không thể tự hạ quyền quản trị của mình');
    }
    const targetObjectId = this.objectId(targetId, 'User ID');
    const target = await this.accountModel
      .findById(targetObjectId)
      .select('role isActive isBlocked expireBlockAt isDeleted')
      .lean();
    if (!target || target.isDeleted) throw new NotFoundException('Không tìm thấy tài khoản');
    if (target.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      await this.assertNotLastActiveAdmin(target as any);
    }

    const updated = await this.accountModel
      .findByIdAndUpdate(
        targetObjectId,
        { $set: { role }, $inc: { authVersion: 1 } },
        { new: true, runValidators: true },
      )
      .select(
        '_id firstName lastName email phone username avatar role isActive isBlocked expireBlockAt blockReason lastLogin createdAt',
      )
      .lean();
    return this.mapAdminUser(updated as any);
  }

  async createAccount(data: CreateAdminAccountDto): Promise<any> {
    if (Buffer.byteLength(data.password, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không được vượt quá 72 byte');
    }
    const email = data.email.toLowerCase().trim();
    const username = data.username.trim();
    const existing = await this.accountModel
      .findOne({ $or: [{ email }, { username }] })
      .select('email username')
      .lean();
    if (existing) throw new BadRequestException('Email hoặc username đã tồn tại');

    const nameParts = data.fullName.trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts.pop() || '' : '';
    const firstName = nameParts.join(' ') || data.fullName.trim();
    const password = await bcrypt.hash(data.password, 12);
    try {
      const account = await this.accountModel.create({
        firstName,
        lastName,
        email,
        username,
        password,
        role: data.role,
        status: 'DEACTIVE',
        isActive: true,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.fullName)}&background=random`,
        authProvider: 'LOCAL',
      });
      return this.mapAdminUser(account.toObject());
    } catch (error: any) {
      if (error?.code === 11000) throw new BadRequestException('Email hoặc username đã tồn tại');
      throw error;
    }
  }

  async getPosts(query: AdminPostQueryDto): Promise<any> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 10));
    const filter: Record<string, any> = { isDeleted: { $ne: true } };
    if (query.status === 'ACTIVE') filter.isActive = true;
    if (query.status === 'HIDDEN') filter.isActive = false;
    if (query.privacy && query.privacy !== 'ALL') filter.privacy = query.privacy;
    if (query.search) filter.$text = { $search: query.search };

    const sortMapping: Record<string, string> = {
      time: 'createdAt',
      reactions: 'totalReacts',
      comments: 'totalComments',
      shares: 'totalShares',
      createdAt: 'createdAt',
    };
    const sortField = sortMapping[query.sortBy || ''] || 'createdAt';
    const sort = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 } as Record<string, 1 | -1>;
    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('userId', 'firstName lastName avatar username')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.postModel.countDocuments(filter),
    ]);
    return {
      data: posts.map((post) => ({
        id: post._id,
        author: post.userId
          ? `${(post.userId as any).firstName || ''} ${(post.userId as any).lastName || ''}`.trim()
          : 'Unknown',
        authorAvatar: (post.userId as any)?.avatar,
        content: post.content,
        privacy: post.privacy,
        reactions: post.totalReacts || 0,
        comments: post.totalComments || 0,
        shares: post.totalShares || 0,
        status: post.isActive === false ? 'HIDDEN' : 'ACTIVE',
        time: this.getTimeAgo(post.createdAt),
        createdAt: post.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getPostById(id: string): Promise<any> {
    const post = await this.postModel
      .findById(this.objectId(id, 'Post ID'))
      .populate('userId', 'firstName lastName avatar username')
      .populate('groupId', 'name avatar')
      .lean();
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  async deletePost(id: string): Promise<any> {
    const post = await this.postModel.findOneAndUpdate(
      { _id: this.objectId(id, 'Post ID'), isDeleted: { $ne: true } },
      { $set: { isDeleted: true, isActive: false, deletedAt: new Date() } },
      { new: true },
    );
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return { message: 'Đã xóa bài viết' };
  }

  async hidePost(id: string): Promise<Post> {
    const post = await this.postModel.findOneAndUpdate(
      { _id: this.objectId(id, 'Post ID'), isDeleted: { $ne: true } },
      { $set: { isActive: false } },
      { new: true },
    );
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  async showPost(id: string): Promise<Post> {
    const post = await this.postModel.findOneAndUpdate(
      { _id: this.objectId(id, 'Post ID'), isDeleted: { $ne: true } },
      { $set: { isActive: true } },
      { new: true },
    );
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  private getTimeAgo(date: Date): string {
    const diff = Math.max(0, Date.now() - new Date(date).getTime());
    const minutes = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
    return `${Math.floor(days / 30)} tháng trước`;
  }

  async getTrafficData(
    days = 7,
  ): Promise<Array<{ date: string; logins: number; activeUsers: number }>> {
    const safeDays = Math.min(90, Math.max(1, Math.floor(days || 7)));
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (safeDays - 1));
    start.setUTCHours(0, 0, 0, 0);

    const stats = await this.accountModel.aggregate([
      { $match: { isDeleted: { $ne: true }, 'loginHistory.date': { $gte: start, $lte: end } } },
      { $unwind: '$loginHistory' },
      { $match: { 'loginHistory.date': { $gte: start, $lte: end } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$loginHistory.date',
              timezone: 'UTC',
            },
          },
          logins: { $sum: '$loginHistory.count' },
          users: { $addToSet: '$_id' },
        },
      },
      { $project: { _id: 1, logins: 1, activeUsers: { $size: '$users' } } },
    ]);
    const byDate = new Map(stats.map((row) => [row._id, row]));
    return Array.from({ length: safeDays }, (_, offset) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + offset);
      const key = date.toISOString().slice(0, 10);
      const row = byDate.get(key);
      return { date: key, logins: row?.logins || 0, activeUsers: row?.activeUsers || 0 };
    });
  }
}
