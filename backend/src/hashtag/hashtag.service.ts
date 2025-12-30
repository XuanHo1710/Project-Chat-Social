import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Hashtag, HashtagDocument } from './entities/hashtag.entity';
import {
    HashtagMapping,
    HashtagMappingDocument,
    HashtagEntityType,
} from './entities/hashtag-mapping.entity';
import { HashtagStats, HashtagStatsDocument } from './entities/hashtag-stats.entity';

@Injectable()
export class HashtagService {
    // Regex để extract hashtags từ text
    // Matches #word với Unicode support
    private readonly HASHTAG_REGEX = /#([\w\u00C0-\u024F\u1E00-\u1EFF]+)/gi;

    constructor(
        @InjectModel(Hashtag.name)
        private hashtagModel: Model<HashtagDocument>,
        @InjectModel(HashtagMapping.name)
        private hashtagMappingModel: Model<HashtagMappingDocument>,
        @InjectModel(HashtagStats.name)
        private hashtagStatsModel: Model<HashtagStatsDocument>,
    ) { }

    /**
     * Extract hashtags from text content
     * @returns Array of { normalized, display } objects
     */
    extractHashtags(content: string): Array<{ normalized: string; display: string }> {
        if (!content) return [];

        const matches = content.matchAll(this.HASHTAG_REGEX);
        const hashtags: Array<{ normalized: string; display: string }> = [];
        const seen = new Set<string>();

        for (const match of matches) {
            const display = match[1]; // Without #
            const normalized = display.toLowerCase();

            // Avoid duplicates in same content
            if (!seen.has(normalized)) {
                seen.add(normalized);
                hashtags.push({ normalized, display });
            }
        }

        return hashtags;
    }

    /**
     * Process hashtags when creating/updating a post or comment
     * - Extract từ content
     * - Upsert vào bảng hashtags
     * - Lưu vào bảng mapping
     * - Update stats
     */
    async processHashtags(
        content: string,
        entityId: string | Types.ObjectId,
        entityType: HashtagEntityType,
        userId?: string,
    ): Promise<Hashtag[]> {
        const extracted = this.extractHashtags(content);
        if (extracted.length === 0) return [];

        const entityObjId = typeof entityId === 'string' ? new Types.ObjectId(entityId) : entityId;
        const processedHashtags: Hashtag[] = [];

        // Process each hashtag
        for (const { normalized, display } of extracted) {
            // Upsert hashtag (get or create)
            const hashtag = await this.hashtagModel.findOneAndUpdate(
                { tagTextLowercase: normalized },
                {
                    $setOnInsert: { tagTextLowercase: normalized, displayText: display },
                    $inc: { usageCount: 1 },
                },
                { upsert: true, new: true },
            );

            processedHashtags.push(hashtag);

            // Create mapping (ignore duplicate errors)
            try {
                await this.hashtagMappingModel.create({
                    hashtagId: hashtag._id,
                    entityId: entityObjId,
                    entityType,
                });
            } catch (error: any) {
                // Ignore duplicate key error (code 11000)
                if (error.code !== 11000) throw error;
            }

            // Update stats (daily)
            await this.updateStats(hashtag._id as unknown as Types.ObjectId, userId);
        }

        return processedHashtags;
    }

    /**
     * Remove hashtag mappings when updating/deleting entity
     * Also decrement usage counts
     */
    async removeHashtagMappings(
        entityId: string | Types.ObjectId,
        entityType: HashtagEntityType,
    ): Promise<void> {
        const entityObjId = typeof entityId === 'string' ? new Types.ObjectId(entityId) : entityId;

        // Find all mappings for this entity
        const mappings = await this.hashtagMappingModel.find({
            entityId: entityObjId,
            entityType,
        });

        // Decrement usage count for each hashtag
        for (const mapping of mappings) {
            await this.hashtagModel.findByIdAndUpdate(mapping.hashtagId, {
                $inc: { usageCount: -1 },
            });
        }

        // Delete all mappings
        await this.hashtagMappingModel.deleteMany({
            entityId: entityObjId,
            entityType,
        });
    }

    /**
     * Update hashtag mappings when content is edited
     * - Remove old mappings
     * - Process new hashtags
     */
    async updateHashtags(
        content: string,
        entityId: string | Types.ObjectId,
        entityType: HashtagEntityType,
        userId?: string,
    ): Promise<Hashtag[]> {
        await this.removeHashtagMappings(entityId, entityType);
        return this.processHashtags(content, entityId, entityType, userId);
    }

    /**
     * Update daily stats for trending
     */
    private async updateStats(hashtagId: Types.ObjectId | any, userId?: string): Promise<void> {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        await this.hashtagStatsModel.findOneAndUpdate(
            {
                hashtagId,
                periodDate: startOfDay,
                periodType: 'DAILY',
            },
            {
                $inc: { usageCount: 1 },
                // Note: uniqueUsers tracking would require more complex logic
                // For now, just increment usage count
            },
            { upsert: true },
        );
    }

    /**
     * Search/autocomplete hashtags
     */
    async searchHashtags(query: string, limit = 10): Promise<Hashtag[]> {
        const normalized = query.toLowerCase().replace(/^#/, '');

        return this.hashtagModel
            .find({
                tagTextLowercase: { $regex: `^${normalized}`, $options: 'i' },
            })
            .sort({ usageCount: -1 })
            .limit(limit)
            .exec();
    }

    /**
     * Get trending hashtags
     * @param period 'DAILY' | 'WEEKLY'
     * @param limit Number of results
     */
    async getTrendingHashtags(period: 'DAILY' | 'WEEKLY' = 'DAILY', limit = 10): Promise<any[]> {
        const now = new Date();
        let startDate: Date;

        if (period === 'DAILY') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else {
            // Last 7 days
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Aggregate stats for the period
        const trending = await this.hashtagStatsModel.aggregate([
            {
                $match: {
                    periodType: 'DAILY',
                    periodDate: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: '$hashtagId',
                    totalUsage: { $sum: '$usageCount' },
                },
            },
            { $sort: { totalUsage: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'hashtags',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'hashtag',
                },
            },
            { $unwind: '$hashtag' },
            {
                $project: {
                    _id: '$hashtag._id',
                    tagTextLowercase: '$hashtag.tagTextLowercase',
                    displayText: '$hashtag.displayText',
                    usageCount: '$totalUsage',
                },
            },
        ]);

        return trending;
    }

    /**
     * Get all hashtags for an entity
     */
    async getHashtagsForEntity(
        entityId: string | Types.ObjectId,
        entityType: HashtagEntityType,
    ): Promise<Hashtag[]> {
        const entityObjId = typeof entityId === 'string' ? new Types.ObjectId(entityId) : entityId;

        const mappings = await this.hashtagMappingModel
            .find({ entityId: entityObjId, entityType })
            .populate('hashtagId')
            .exec();

        return mappings.map((m) => m.hashtagId as unknown as Hashtag);
    }

    /**
     * Get posts/comments by hashtag
     */
    async getEntitiesByHashtag(
        hashtagText: string,
        entityType: HashtagEntityType,
        page = 1,
        limit = 10,
    ): Promise<{ entityIds: (Types.ObjectId | any)[]; total: number; page: number; totalPages: number }> {
        const normalized = hashtagText.toLowerCase().replace(/^#/, '');
        const skip = (page - 1) * limit;

        // Find the hashtag
        const hashtag = await this.hashtagModel.findOne({ tagTextLowercase: normalized });
        if (!hashtag) {
            return { entityIds: [], total: 0, page, totalPages: 0 };
        }

        // Count total
        const total = await this.hashtagMappingModel.countDocuments({
            hashtagId: hashtag._id,
            entityType,
        });

        // Get paginated entity IDs
        const mappings = await this.hashtagMappingModel
            .find({ hashtagId: hashtag._id, entityType })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        return {
            entityIds: mappings.map((m) => m.entityId),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Get hashtag by text
     */
    async findByText(text: string): Promise<Hashtag | null> {
        const normalized = text.toLowerCase().replace(/^#/, '');
        return this.hashtagModel.findOne({ tagTextLowercase: normalized });
    }
}
