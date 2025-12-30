import { Controller, Get, Query, Param } from '@nestjs/common';
import { HashtagService } from './hashtag.service';
import { HashtagEntityType } from './entities/hashtag-mapping.entity';
import { Public } from 'decorators/customize';

@Controller('hashtags')
export class HashtagController {
    constructor(private readonly hashtagService: HashtagService) { }

    /**
     * Search/autocomplete hashtags
     * GET /hashtags/search?q=react&limit=10
     */
    @Get('search')
    @Public() // Cho phép không cần auth để gợi ý hashtag
    async searchHashtags(@Query('q') query: string, @Query('limit') limit?: string) {
        const hashtags = await this.hashtagService.searchHashtags(query, parseInt(limit || '10', 10));
        return {
            data: hashtags.map((h) => ({
                id: h._id,
                tag: h.displayText,
                tagLowercase: h.tagTextLowercase,
                usageCount: h.usageCount,
            })),
        };
    }

    /**
     * Get trending hashtags
     * GET /hashtags/trending?period=DAILY&limit=10
     */
    @Get('trending')
    @Public()
    async getTrendingHashtags(
        @Query('period') period?: 'DAILY' | 'WEEKLY',
        @Query('limit') limit?: string,
    ) {
        const trending = await this.hashtagService.getTrendingHashtags(
            period || 'DAILY',
            parseInt(limit || '10', 10),
        );
        return {
            data: trending.map((h) => ({
                id: h._id,
                tag: h.displayText,
                tagLowercase: h.tagTextLowercase,
                usageCount: h.usageCount,
            })),
        };
    }

    /**
     * Get posts by hashtag
     * GET /hashtags/:tag/posts?page=1&limit=10
     */
    @Get(':tag/posts')
    @Public()
    async getPostsByHashtag(
        @Param('tag') tag: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        const result = await this.hashtagService.getEntitiesByHashtag(
            tag,
            HashtagEntityType.POST,
            parseInt(page || '1', 10),
            parseInt(limit || '10', 10),
        );

        return {
            postIds: result.entityIds,
            total: result.total,
            page: result.page,
            totalPages: result.totalPages,
        };
    }

    /**
     * Get hashtag info
     * GET /hashtags/:tag
     */
    @Get(':tag')
    @Public()
    async getHashtag(@Param('tag') tag: string) {
        const hashtag = await this.hashtagService.findByText(tag);
        if (!hashtag) {
            return { data: null };
        }

        return {
            data: {
                id: hashtag._id,
                tag: hashtag.displayText,
                tagLowercase: hashtag.tagTextLowercase,
                usageCount: hashtag.usageCount,
            },
        };
    }
}
