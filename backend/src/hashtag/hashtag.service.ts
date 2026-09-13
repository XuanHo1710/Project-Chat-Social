import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Hashtag, HashtagDocument } from './entities/hashtag.entity';
import {
  HashtagEntityType,
  HashtagMapping,
  HashtagMappingDocument,
} from './entities/hashtag-mapping.entity';
import { HashtagStats, HashtagStatsDocument } from './entities/hashtag-stats.entity';

interface ExtractedHashtag {
  normalized: string;
  display: string;
}

@Injectable()
export class HashtagService {
  private readonly HASHTAG_REGEX = /#([\w\u00C0-\u024F\u1E00-\u1EFF]+)/giu;
  private readonly MAX_HASHTAGS_PER_ENTITY = 30;
  private readonly MAX_HASHTAG_LENGTH = 64;

  constructor(
    @InjectModel(Hashtag.name) private readonly hashtagModel: Model<HashtagDocument>,
    @InjectModel(HashtagMapping.name)
    private readonly hashtagMappingModel: Model<HashtagMappingDocument>,
    @InjectModel(HashtagStats.name)
    private readonly hashtagStatsModel: Model<HashtagStatsDocument>,
  ) {}

  private clampLimit(limit: number, fallback = 10, max = 50): number {
    return Number.isFinite(limit) ? Math.min(max, Math.max(1, Math.floor(limit))) : fallback;
  }

  private clampPage(page: number): number {
    return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  }

  private normalizeText(text: string): string {
    return String(text || '').trim().replace(/^#/, '').toLocaleLowerCase('vi-VN');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private objectId(value: string | Types.ObjectId): Types.ObjectId {
    if (value instanceof Types.ObjectId) return value;
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('ID không hợp lệ');
    return new Types.ObjectId(value);
  }

  extractHashtags(content: string): ExtractedHashtag[] {
    if (!content) return [];

    const hashtags: ExtractedHashtag[] = [];
    const seen = new Set<string>();
    for (const match of content.matchAll(this.HASHTAG_REGEX)) {
      const display = match[1];
      const normalized = display.toLocaleLowerCase('vi-VN');
      if (
        normalized.length > this.MAX_HASHTAG_LENGTH ||
        seen.has(normalized)
      ) {
        continue;
      }

      seen.add(normalized);
      hashtags.push({ normalized, display });
      if (hashtags.length >= this.MAX_HASHTAGS_PER_ENTITY) break;
    }
    return hashtags;
  }

  private async upsertHashtagDocuments(extracted: ExtractedHashtag[]): Promise<HashtagDocument[]> {
    if (extracted.length === 0) return [];
    await this.hashtagModel.bulkWrite(
      extracted.map(({ normalized, display }) => ({
        updateOne: {
          filter: { tagTextLowercase: normalized },
          update: {
            $setOnInsert: {
              tagTextLowercase: normalized,
              displayText: display,
              usageCount: 0,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return this.hashtagModel.find({
      tagTextLowercase: { $in: extracted.map((item) => item.normalized) },
    });
  }

  private async addMappings(
    entityId: Types.ObjectId,
    entityType: HashtagEntityType,
    hashtags: HashtagDocument[],
  ): Promise<Types.ObjectId[]> {
    if (hashtags.length === 0) return [];
    const operations = hashtags.map((hashtag) => ({
      updateOne: {
        filter: { hashtagId: hashtag._id, entityId, entityType },
        update: { $setOnInsert: { hashtagId: hashtag._id, entityId, entityType } },
        upsert: true,
      },
    }));

    let result: any;
    try {
      result = await this.hashtagMappingModel.bulkWrite(operations, { ordered: false });
    } catch (error: any) {
      const nonDuplicate = error?.writeErrors?.find((item: any) => item?.code !== 11000);
      if (nonDuplicate || error?.code !== 11000) throw error;
      result = error?.result;
    }

    const upsertedIds = result?.upsertedIds || result?.result?.upsertedIds || {};
    return Object.keys(upsertedIds)
      .map((index) => {
        const id = hashtags[Number(index)]?._id;
        return id ? new Types.ObjectId(id.toString()) : null;
      })
      .filter((id): id is Types.ObjectId => id !== null);
  }

  private async incrementUsage(hashtagIds: Types.ObjectId[]): Promise<void> {
    if (hashtagIds.length === 0) return;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await Promise.all([
      this.hashtagModel.bulkWrite(
        hashtagIds.map((hashtagId) => ({
          updateOne: { filter: { _id: hashtagId }, update: { $inc: { usageCount: 1 } } },
        })),
        { ordered: false },
      ),
      this.hashtagStatsModel.bulkWrite(
        hashtagIds.map((hashtagId) => ({
          updateOne: {
            filter: { hashtagId, periodDate: startOfDay, periodType: 'DAILY' },
            update: {
              $setOnInsert: { hashtagId, periodDate: startOfDay, periodType: 'DAILY' },
              $inc: { usageCount: 1 },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      ),
    ]);
  }

  private async decrementUsage(hashtagIds: Types.ObjectId[]): Promise<void> {
    if (hashtagIds.length === 0) return;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    await Promise.all([
      this.hashtagModel.bulkWrite(
        hashtagIds.map((hashtagId) => ({
          updateOne: {
            filter: { _id: hashtagId },
            update: [
              {
                $set: {
                  usageCount: { $max: [0, { $subtract: ['$usageCount', 1] }] },
                },
              },
            ],
          },
        })),
        { ordered: false },
      ),
      this.hashtagStatsModel.bulkWrite(
        hashtagIds.map((hashtagId) => ({
          updateOne: {
            filter: { hashtagId, periodDate: startOfDay, periodType: 'DAILY' },
            update: [
              {
                $set: {
                  usageCount: {
                    $max: [0, { $subtract: [{ $ifNull: ['$usageCount', 0] }, 1] }],
                  },
                },
              },
            ],
            upsert: false,
          },
        })),
        { ordered: false },
      ),
    ]);
  }

  private async syncHashtags(
    content: string,
    entityId: string | Types.ObjectId,
    entityType: HashtagEntityType,
    removeMissing: boolean,
  ): Promise<Hashtag[]> {
    const entityObjectId = this.objectId(entityId);
    const extracted = this.extractHashtags(content);
    const hashtags = await this.upsertHashtagDocuments(extracted);
    const desiredIds = new Set(hashtags.map((hashtag) => hashtag._id.toString()));

    if (removeMissing) {
      const obsoleteMappings = await this.hashtagMappingModel
        .find({
          entityId: entityObjectId,
          entityType,
          ...(desiredIds.size > 0
            ? { hashtagId: { $nin: [...desiredIds].map((id) => new Types.ObjectId(id)) } }
            : {}),
        })
        .select('_id hashtagId')
        .lean();

      if (obsoleteMappings.length > 0) {
        const deleteResult = await this.hashtagMappingModel.deleteMany({
          _id: { $in: obsoleteMappings.map((mapping) => mapping._id) },
        });
        if (deleteResult.deletedCount > 0) {
          await this.decrementUsage(
            obsoleteMappings
              .slice(0, deleteResult.deletedCount)
              .map((mapping) => new Types.ObjectId(mapping.hashtagId.toString())),
          );
        }
      }
    }

    const addedIds = await this.addMappings(entityObjectId, entityType, hashtags);
    await this.incrementUsage(addedIds);
    return hashtags;
  }

  async processHashtags(
    content: string,
    entityId: string | Types.ObjectId,
    entityType: HashtagEntityType,
    _userId?: string,
  ): Promise<Hashtag[]> {
    return this.syncHashtags(content, entityId, entityType, false);
  }

  async removeHashtagMappings(
    entityId: string | Types.ObjectId,
    entityType: HashtagEntityType,
  ): Promise<void> {
    const entityObjectId = this.objectId(entityId);
    const mappings = await this.hashtagMappingModel
      .find({ entityId: entityObjectId, entityType })
      .select('_id hashtagId')
      .lean();
    if (mappings.length === 0) return;

    const result = await this.hashtagMappingModel.deleteMany({
      _id: { $in: mappings.map((mapping) => mapping._id) },
    });
    if (result.deletedCount > 0) {
      await this.decrementUsage(
        mappings
          .slice(0, result.deletedCount)
          .map((mapping) => new Types.ObjectId(mapping.hashtagId.toString())),
      );
    }
  }

  async updateHashtags(
    content: string,
    entityId: string | Types.ObjectId,
    entityType: HashtagEntityType,
    _userId?: string,
  ): Promise<Hashtag[]> {
    return this.syncHashtags(content, entityId, entityType, true);
  }

  async searchHashtags(query: string, limit = 10): Promise<Hashtag[]> {
    const normalized = this.normalizeText(query);
    if (!normalized || normalized.length > this.MAX_HASHTAG_LENGTH) return [];

    return this.hashtagModel.aggregate([
      { $match: { tagTextLowercase: { $regex: `^${this.escapeRegex(normalized)}` } } },
      {
        $lookup: {
          from: this.hashtagMappingModel.collection.name,
          let: { hashtagId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$hashtagId', '$$hashtagId'] },
                entityType: HashtagEntityType.POST,
              },
            },
            {
              $lookup: {
                from: 'posts',
                localField: 'entityId',
                foreignField: '_id',
                as: 'post',
              },
            },
            { $unwind: '$post' },
            {
              $match: {
                'post.privacy': 'PUBLIC',
                'post.isActive': true,
                'post.isDeleted': { $ne: true },
                'post.groupId': null,
              },
            },
            { $count: 'count' },
          ],
          as: 'publicUsage',
        },
      },
      { $set: { usageCount: { $ifNull: [{ $first: '$publicUsage.count' }, 0] } } },
      { $match: { usageCount: { $gt: 0 } } },
      { $sort: { usageCount: -1, _id: 1 } },
      { $limit: this.clampLimit(limit) },
      { $unset: 'publicUsage' },
    ]);
  }

  async getTrendingHashtags(period: 'DAILY' | 'WEEKLY' = 'DAILY', limit = 10): Promise<any[]> {
    const safePeriod = period === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
    const now = new Date();
    const startDate =
      safePeriod === 'DAILY'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return this.hashtagMappingModel.aggregate([
      {
        $match: {
          entityType: HashtagEntityType.POST,
          createdAt: { $gte: startDate },
        },
      },
      {
        $lookup: {
          from: 'posts',
          localField: 'entityId',
          foreignField: '_id',
          as: 'post',
        },
      },
      { $unwind: '$post' },
      {
        $match: {
          'post.privacy': 'PUBLIC',
          'post.isActive': true,
          'post.isDeleted': { $ne: true },
          'post.groupId': null,
        },
      },
      { $group: { _id: '$hashtagId', totalUsage: { $sum: 1 } } },
      { $sort: { totalUsage: -1, _id: 1 } },
      { $limit: this.clampLimit(limit) },
      {
        $lookup: {
          from: this.hashtagModel.collection.name,
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
  }

  async getHashtagsForEntity(
    entityId: string | Types.ObjectId,
    entityType: HashtagEntityType,
  ): Promise<Hashtag[]> {
    const mappings = await this.hashtagMappingModel
      .find({ entityId: this.objectId(entityId), entityType })
      .populate('hashtagId')
      .lean();
    return mappings.map((mapping) => mapping.hashtagId as unknown as Hashtag);
  }

  async getEntitiesByHashtag(
    hashtagText: string,
    entityType: HashtagEntityType,
    page = 1,
    limit = 10,
  ): Promise<{ entityIds: Types.ObjectId[]; total: number; page: number; totalPages: number }> {
    const normalized = this.normalizeText(hashtagText);
    const safePage = this.clampPage(page);
    const safeLimit = this.clampLimit(limit);
    if (!normalized || normalized.length > this.MAX_HASHTAG_LENGTH) {
      return { entityIds: [], total: 0, page: safePage, totalPages: 0 };
    }

    const hashtag = await this.hashtagModel
      .findOne({ tagTextLowercase: normalized })
      .select('_id')
      .lean();
    if (!hashtag) return { entityIds: [], total: 0, page: safePage, totalPages: 0 };

    const basePipeline: any[] = [
      { $match: { hashtagId: hashtag._id, entityType } },
      { $sort: { createdAt: -1, _id: -1 } },
    ];

    if (entityType === HashtagEntityType.POST) {
      basePipeline.push(
        {
          $lookup: {
            from: 'posts',
            localField: 'entityId',
            foreignField: '_id',
            as: 'post',
          },
        },
        { $unwind: '$post' },
        {
          $match: {
            'post.privacy': 'PUBLIC',
            'post.isActive': true,
            'post.isDeleted': { $ne: true },
            'post.groupId': null,
          },
        },
      );
    }

    const [result] = await this.hashtagMappingModel.aggregate([
      ...basePipeline,
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          rows: [
            { $skip: (safePage - 1) * safeLimit },
            { $limit: safeLimit },
            { $project: { _id: 0, entityId: 1 } },
          ],
        },
      },
    ]);
    const total = result?.metadata?.[0]?.total || 0;
    return {
      entityIds: (result?.rows || []).map((row: { entityId: Types.ObjectId }) => row.entityId),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async findByText(text: string): Promise<Hashtag | null> {
    const normalized = this.normalizeText(text);
    if (!normalized || normalized.length > this.MAX_HASHTAG_LENGTH) return null;
    const [hashtag] = await this.hashtagModel.aggregate([
      { $match: { tagTextLowercase: normalized } },
      {
        $lookup: {
          from: this.hashtagMappingModel.collection.name,
          let: { hashtagId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$hashtagId', '$$hashtagId'] },
                entityType: HashtagEntityType.POST,
              },
            },
            {
              $lookup: {
                from: 'posts',
                localField: 'entityId',
                foreignField: '_id',
                as: 'post',
              },
            },
            { $unwind: '$post' },
            {
              $match: {
                'post.privacy': 'PUBLIC',
                'post.isActive': true,
                'post.isDeleted': { $ne: true },
                'post.groupId': null,
              },
            },
            { $count: 'count' },
          ],
          as: 'publicUsage',
        },
      },
      { $set: { usageCount: { $ifNull: [{ $first: '$publicUsage.count' }, 0] } } },
      { $match: { usageCount: { $gt: 0 } } },
      { $unset: 'publicUsage' },
    ]);
    return hashtag || null;
  }
}
