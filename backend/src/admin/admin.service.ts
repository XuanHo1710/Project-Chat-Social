import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from '../account/entities/account.entity';
import { Post, PostDocument } from '../post/entities/post.entity';
import { Comment, CommentDocument } from '../comment/entities/comment.entity';
import { Reaction, ReactionDocument } from '../reaction/entities/reaction.entity';

interface PaginationQuery {
    page: number;
    limit: number;
    status?: string;
    role?: string;
    privacy?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
}

@Injectable()
export class AdminService {
    constructor(
        @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
        @InjectModel(Post.name) private postModel: Model<PostDocument>,
        @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
        @InjectModel(Reaction.name) private reactionModel: Model<ReactionDocument>,
    ) { }

    // ========== DASHBOARD STATISTICS ==========

    async getDashboardStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Total Users
        const totalUsers = await this.accountModel.countDocuments({ isDeleted: { $ne: true } });
        const newUsersToday = await this.accountModel.countDocuments({
            createdAt: { $gte: today },
            isDeleted: { $ne: true }
        });

        // Online Users (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await this.accountModel.countDocuments({
            status: 'ACTIVE',
            lastActive: { $gte: fiveMinutesAgo },
            isDeleted: { $ne: true }
        });

        // Total Posts
        const totalPosts = await this.postModel.countDocuments({ isDeleted: { $ne: true } });
        const newPostsToday = await this.postModel.countDocuments({
            createdAt: { $gte: today },
            isDeleted: { $ne: true }
        });

        // Total Comments
        const totalComments = await this.commentModel.countDocuments({ isDeleted: { $ne: true } });

        // Reactions count
        const totalReactions = await this.reactionModel.countDocuments({});

        // Calculate percentage change (compare with yesterday)
        const usersYesterday = await this.accountModel.countDocuments({
            createdAt: { $gte: yesterday, $lt: today },
            isDeleted: { $ne: true }
        });
        const userChange = newUsersToday > 0 && usersYesterday > 0
            ? Math.round(((newUsersToday - usersYesterday) / usersYesterday) * 100)
            : newUsersToday > 0 ? 100 : 0;

        return {
            totalUsers,
            newUsersToday,
            userChange,
            onlineUsers,
            totalPosts,
            newPostsToday,
            totalComments,
            totalReactions
        };
    }

    async getWeeklyPostsStats() {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        weekAgo.setHours(0, 0, 0, 0);

        // Get posts for each day of the week
        const stats = await this.postModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: weekAgo, $lte: today },
                    isDeleted: { $ne: true }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: '$createdAt' }, // 1 = Sunday, 2 = Monday, ...
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Map to weekday labels (T2-CN)
        const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const result = dayLabels.map((label, index) => {
            const dayData = stats.find(s => s._id === (index === 0 ? 1 : index + 1));
            return {
                day: label,
                count: dayData ? dayData.count : 0
            };
        });

        // Reorder: T2, T3, T4, T5, T6, T7, CN
        const orderedResult = [
            ...result.slice(1), // T2 to T7
            result[0] // CN
        ];

        return orderedResult;
    }

    async getTopPagesStats() {
        // Mock data - in real impl, you'd track page views
        return [
            { name: 'Trang chủ', views: 4520, percentage: 45.2 },
            { name: 'Reels', views: 3210, percentage: 32.1 },
            { name: 'Tin nhắn', views: 2840, percentage: 28.4 },
            { name: 'Nhóm', views: 1830, percentage: 18.3 },
            { name: 'Thông báo', views: 1230, percentage: 12.3 },
        ];
    }

    async getRecentComments(): Promise<any> {
        const comments = await this.commentModel
            .find({ isDeleted: { $ne: true } })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('userId', 'firstName lastName avatar')
            .lean();

        return comments.map(comment => ({
            id: comment._id,
            user: comment.userId
                ? `${(comment.userId as any).firstName} ${(comment.userId as any).lastName}`
                : 'Anonymous',
            avatar: (comment.userId as any)?.avatar || '',
            content: comment.content,
            time: this.getTimeAgo(comment.createdAt)
        }));
    }

    async getEmotionStats() {
        const emotions = await this.reactionModel.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = emotions.reduce((sum, e) => sum + e.count, 0);

        const emotionMap: Record<string, { label: string; color: string }> = {
            LIKE: { label: 'Like', color: '#1877f2' },
            LOVE: { label: 'Love', color: '#f23e5c' },
            HAHA: { label: 'Haha', color: '#f7b928' },
            WOW: { label: 'Wow', color: '#f7b928' },
            SAD: { label: 'Sad', color: '#f7b928' },
            ANGRY: { label: 'Angry', color: '#e9710f' }
        };

        return emotions.map(e => ({
            type: e._id,
            label: emotionMap[e._id]?.label || e._id,
            count: e.count,
            percentage: total > 0 ? Math.round((e.count / total) * 100) : 0,
            color: emotionMap[e._id]?.color || '#65676b'
        }));
    }

    // ========== USER MANAGEMENT ==========

    async getUsers(query: PaginationQuery): Promise<any> {
        const { page, limit, status, role, sortBy = 'createdAt', sortOrder = 'desc', search } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter: any = { isDeleted: { $ne: true } };

        if (status) {
            if (status === 'ACTIVE') filter.isBlocked = { $ne: true };
            else if (status === 'BLOCKED') filter.isBlocked = true;
            else if (status === 'PENDING') filter.isActive = false;
        }

        if (role && role !== 'ALL') {
            filter.role = role;
        }

        if (search) {
            filter.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        const sortMapping: Record<string, string> = {
            lastLogin: 'lastLogin',
            email: 'email',
            name: 'firstName',
            createdAt: 'createdAt'
        };
        const sortField = sortMapping[sortBy] || 'createdAt';
        const sort: any = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

        const [users, total] = await Promise.all([
            this.accountModel
                .find(filter)
                .select('-password -accessToken -resetPasswordToken')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.accountModel.countDocuments(filter)
        ]);

        return {
            data: users.map(user => ({
                id: user._id,
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role,
                status: user.isBlocked ? 'BLOCKED' : (user.isActive ? 'ACTIVE' : 'PENDING'),
                lastLogin: user.lastLogin ? this.getTimeAgo(user.lastLogin) : 'Chưa đăng nhập',
                createdAt: user.createdAt
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getUserById(id: string): Promise<any> {
        return this.accountModel
            .findById(id)
            .select('-password -accessToken -resetPasswordToken')
            .lean();
    }

    async blockUser(id: string, reason?: string, expireAt?: Date) {
        return this.accountModel.findByIdAndUpdate(id, {
            isBlocked: true,
            expireBlockAt: expireAt || null,
            $push: {
                blockHistory: {
                    reason,
                    blockedAt: new Date(),
                    expireAt
                }
            }
        }, { new: true }).select('-password -accessToken');
    }

    async unblockUser(id: string) {
        return this.accountModel.findByIdAndUpdate(id, {
            isBlocked: false,
            expireBlockAt: null
        }, { new: true }).select('-password -accessToken');
    }

    async updateUserRole(id: string, role: string) {
        if (!['USER', 'ADMIN', 'EMPLOYEE'].includes(role)) {
            throw new Error('Invalid role');
        }
        return this.accountModel.findByIdAndUpdate(id, { role }, { new: true })
            .select('-password -accessToken');
    }

    // ========== POST MANAGEMENT ==========

    async getPosts(query: PaginationQuery): Promise<any> {
        const { page, limit, status, privacy, sortBy = 'createdAt', sortOrder = 'desc', search } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter: any = { isDeleted: { $ne: true } };

        if (status && status !== 'ALL') {
            if (status === 'ACTIVE') filter.isHidden = { $ne: true };
            else if (status === 'HIDDEN') filter.isHidden = true;
            else if (status === 'REPORTED') filter.reportCount = { $gt: 0 };
        }

        if (privacy && privacy !== 'ALL') {
            filter.privacy = privacy;
        }

        if (search) {
            filter.$or = [
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        // Build sort
        const sortMapping: Record<string, string> = {
            time: 'createdAt',
            reactions: 'reactionCount',
            comments: 'commentCount',
            shares: 'shareCount',
            createdAt: 'createdAt'
        };
        const sortField = sortMapping[sortBy] || 'createdAt';
        const sort: any = { [sortField]: sortOrder === 'asc' ? 1 : -1 };

        const [posts, total] = await Promise.all([
            this.postModel
                .find(filter)
                .populate('author', 'firstName lastName avatar username')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            this.postModel.countDocuments(filter)
        ]);

        // Get reaction and comment counts for each post
        const postsWithStats = await Promise.all(posts.map(async (post) => {
            const [reactionCount, commentCount] = await Promise.all([
                this.reactionModel.countDocuments({ postId: post._id }),
                this.commentModel.countDocuments({ postId: post._id, isDeleted: { $ne: true } })
            ]);

            return {
                id: post._id,
                author: post.userId
                    ? `${(post.userId as any).firstName || ''} ${(post.userId as any).lastName || ''}`.trim()
                    : 'Unknown',
                authorAvatar: (post.userId as any)?.avatar,
                content: post.content,
                privacy: post.privacy,
                reactions: reactionCount,
                comments: commentCount,
                shares: (post as any).shareCount || 0,
                status: (post as any).isHidden ? 'HIDDEN' : ((post as any).reportCount > 0 ? 'REPORTED' : 'ACTIVE'),
                time: this.getTimeAgo(post.createdAt),
                createdAt: post.createdAt
            };
        }));

        return {
            data: postsWithStats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getPostById(id: string): Promise<any> {
        return this.postModel
            .findById(id)
            .populate('author', 'firstName lastName avatar username')
            .lean();
    }

    async deletePost(id: string) {
        return this.postModel.findByIdAndUpdate(id, { isDeleted: true }, { new: true });
    }

    async hidePost(id: string) {
        return this.postModel.findByIdAndUpdate(id, { isHidden: true }, { new: true });
    }

    async showPost(id: string) {
        return this.postModel.findByIdAndUpdate(id, { isHidden: false }, { new: true });
    }

    // ========== HELPER METHODS ==========

    private getTimeAgo(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Vừa xong';
        if (minutes < 60) return `${minutes} phút trước`;
        if (hours < 24) return `${hours} giờ trước`;
        if (days < 7) return `${days} ngày trước`;
        if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
        return `${Math.floor(days / 30)} tháng trước`;
    }

    /**
     * Lấy thống kê traffic (logins & active users) trong N ngày gần nhất
     */
    async getTrafficData(days: number = 7): Promise<Array<{ date: string; logins: number; activeUsers: number }>> {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);

        const result: Array<{ date: string; logins: number; activeUsers: number }> = [];

        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];

            // Đếm số lượt đăng nhập trong ngày này từ loginHistory
            const loginStats = await this.accountModel.aggregate([
                { $unwind: { path: '$loginHistory', preserveNullAndEmptyArrays: false } },
                {
                    $match: {
                        'loginHistory.date': {
                            $gte: new Date(dateStr + 'T00:00:00.000Z'),
                            $lt: new Date(dateStr + 'T23:59:59.999Z')
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalLogins: { $sum: '$loginHistory.count' },
                        uniqueUsers: { $addToSet: '$_id' }
                    }
                }
            ]);

            result.push({
                date: dateStr,
                logins: loginStats[0]?.totalLogins || 0,
                activeUsers: loginStats[0]?.uniqueUsers?.length || 0
            });
        }

        return result;
    }
}
