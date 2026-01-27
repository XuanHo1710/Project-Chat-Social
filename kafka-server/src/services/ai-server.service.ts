import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface EmbedPostRequest {
    post_id: string;
    content: string;
    user_id: string;
    privacy?: string;
    group_id?: string;
    created_at?: string;
    media_type?: string;
}

export interface RecommendedPost {
    post_id: string;
    score: number;
    content?: string;
}

/**
 * Service để giao tiếp với AI Server (Python FastAPI)
 * 
 * AI Server endpoints:
 * - POST /embed/post - Embed post vào ChromaDB
 * - GET /recommend/{user_id} - Gợi ý posts cho user
 * - GET /newsfeed/{user_id} - Lấy newsfeed
 * - DELETE /embed/post/{post_id} - Xóa embedding
 */
@Injectable()
export class AIServerService {
    private readonly logger = new Logger('AIServerService');
    private readonly aiServerUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.aiServerUrl = this.configService.get<string>('AI_SERVER_URL') || 'http://localhost:8000/api/v1';
        this.logger.log(`AI Server URL: ${this.aiServerUrl}`);
    }

    /**
     * Embed a post vào ChromaDB qua AI Server
     */
    async embedPost(request: EmbedPostRequest): Promise<boolean> {
        // ... (code cũ giữ nguyên)
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiServerUrl}/embed/post`, request, {
                    timeout: 10000,
                })
            );

            this.logger.log(`✅ Embedded post ${request.post_id} to AI Server`);
            return response.data?.success === true;
        } catch (error) {
            this.logger.warn(`⚠️ Failed to embed post ${request.post_id}: ${error.message}`);
            return false;
        }
    }

    /**
     * Send interaction to AI Server for Real-time Learning
     */
    async trackInteraction(userId: string, targetId: string, interactionType: string): Promise<boolean> {
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.aiServerUrl}/interaction`, {
                    user_id: userId,
                    target_id: targetId,
                    interaction_type: interactionType,
                }, { timeout: 3000 }) // Fast timeout
            );
            return response.data?.success === true;
        } catch (error) {
            // Non-blocking error logging
            // this.logger.debug(`Failed to track interaction: ${error.message}`);
            return false;
        }
    }

    /**
     * Xóa embedding của post từ ChromaDB
     */
    async deletePostEmbedding(postId: string): Promise<boolean> {
        try {
            await firstValueFrom(
                this.httpService.delete(`${this.aiServerUrl}/embed/post/${postId}`, {
                    timeout: 10000,
                })
            );

            this.logger.log(`🗑️ Deleted post embedding ${postId}`);
            return true;
        } catch (error) {
            this.logger.warn(`⚠️ Failed to delete post embedding ${postId}: ${error.message}`);
            return false;
        }
    }

    /**
     * Lấy recommended posts cho user từ AI Server
     */
    async getRecommendations(
        userId: string,
        friendIds: string[] = [],
        limit: number = 20,
        page: number = 1,
        mediaType?: string,
    ): Promise<{ posts: RecommendedPost[]; total: number }> {
        try {
            const params = new URLSearchParams({
                friend_ids: friendIds.join(','),
                limit: limit.toString(),
                page: page.toString(),
            });

            if (mediaType) {
                params.append('media_type', mediaType);
            }

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.aiServerUrl}/recommend/${userId}?${params.toString()}`,
                    { timeout: 15000 }
                )
            );

            const data = response.data;

            return {
                posts: data.posts?.map((p: any) => ({
                    post_id: p.post_id,
                    score: p.score || 0,
                    content: p.content,
                })) || [],
                total: data.total || 0,
            };
        } catch (error) {
            this.logger.warn(`⚠️ Failed to get recommendations for ${userId}: ${error.message}`);
            return { posts: [], total: 0 };
        }
    }

    /**
     * Lấy newsfeed cho user từ AI Server
     */
    async getNewsfeed(
        userId: string,
        friendIds: string[] = [],
        limit: number = 20,
        page: number = 1,
    ): Promise<{ posts: RecommendedPost[]; total: number }> {
        try {
            const params = new URLSearchParams({
                friend_ids: friendIds.join(','),
                limit: limit.toString(),
                page: page.toString(),
            });

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.aiServerUrl}/newsfeed/${userId}?${params.toString()}`,
                    { timeout: 15000 }
                )
            );

            const data = response.data;

            return {
                posts: data.posts?.map((p: any) => ({
                    post_id: p.post_id,
                    score: p.score || 0,
                    content: p.content,
                })) || [],
                total: data.total || 0,
            };
        } catch (error) {
            this.logger.warn(`⚠️ Failed to get newsfeed for ${userId}: ${error.message}`);
            return { posts: [], total: 0 };
        }
    }

    /**
     * Kiểm tra AI Server có sẵn sàng không
     */
    async isReady(): Promise<boolean> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.aiServerUrl}/status`, { timeout: 5000 })
            );
            return response.data?.ready === true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Tìm kiếm posts
     */
    async searchPosts(
        query: string,
        currentUserId: string = '',
        friendIds: string[] = [],
        limit: number = 20,
        page: number = 1,
    ): Promise<{ posts: RecommendedPost[]; total: number }> {
        try {
            const params = new URLSearchParams({
                q: query,
                current_user_id: currentUserId,
                friend_ids: friendIds.join(','),
                limit: limit.toString(),
                page: page.toString(),
            });

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.aiServerUrl}/search?${params.toString()}`,
                    { timeout: 15000 }
                )
            );

            const data = response.data;

            return {
                posts: data.posts?.map((p: any) => ({
                    post_id: p.post_id,
                    score: p.score || 0,
                    content: p.content,
                })) || [],
                total: data.total || 0,
            };
        } catch (error) {
            this.logger.warn(`⚠️ Failed to search posts: ${error.message}`);
            return { posts: [], total: 0 };
        }
    }
}
