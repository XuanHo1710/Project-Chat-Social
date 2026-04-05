import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { Post, PostDocument } from '../post/entities/post.entity';
import { AIResponse } from './types';

// Response với đầy đủ thông tin post
interface FullPostResponse {
  query?: string;
  user_id?: string;
  post_id?: string;
  total: number;
  page: number;
  totalPages: number;
  posts: any[];
}

@Injectable()
export class RecommendationService {
  private readonly aiServerUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>
  ) {
    this.aiServerUrl =
      this.configService.get<string>('AI_SERVER_URL') || 'http://localhost:8000/api/v1';
  }

  /**
   * Tìm kiếm bài viết theo query
   * Flow: AI Server → lấy post_ids → Query MongoDB → Custom Response
   */
  async search(query: string, limit: number = 20, page: number = 1): Promise<FullPostResponse> {
    try {
      // Step 1: Gọi AI Server để lấy post_ids với scores
      const response: AxiosResponse<AIResponse> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/search`, {
          params: { q: query, limit: limit * 5 }, // Lấy nhiều hơn để phân trang
          timeout: 30000,
        })
      );

      const aiPosts = response.data.posts || [];

      if (aiPosts.length === 0) {
        return {
          query,
          total: 0,
          page,
          totalPages: 0,
          posts: [],
        };
      }

      // Step 2: Phân trang
      const startIndex = (page - 1) * limit;
      const paginatedAIPosts = aiPosts.slice(startIndex, startIndex + limit);
      const postIds = paginatedAIPosts.map((p) => p.post_id);

      // Step 3: Query MongoDB để lấy đầy đủ thông tin
      const posts = await this.postModel
        .find({
          _id: { $in: postIds.map((id) => new Types.ObjectId(id)) },
          isDeleted: false,
        })
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .lean()
        .exec();

      // Step 4: Merge với AI scores và sắp xếp theo thứ tự score
      const scoreMap = new Map(paginatedAIPosts.map((p) => [p.post_id, p.score]));
      const enrichedPosts = posts
        .map((post) => ({
          ...post,
          aiScore: scoreMap.get(post._id.toString()) || 0,
        }))
        .sort((a, b) => b.aiScore - a.aiScore);

      return {
        query,
        total: aiPosts.length,
        page,
        totalPages: Math.ceil(aiPosts.length / limit),
        posts: enrichedPosts,
      };
    } catch (error) {
      console.error('Search Error:', error);
      throw new HttpException(
        'Không thể tìm kiếm. AI Server có thể đang offline.',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Lấy gợi ý bài viết cho user
   * Flow: AI Server → lấy post_ids → Query MongoDB → Custom Response
   */
  async recommend(userId: string, limit: number = 20, page: number = 1): Promise<FullPostResponse> {
    try {
      // Step 1: Gọi AI Server
      const response: AxiosResponse<AIResponse> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/recommend/${userId}`, {
          params: { limit: limit * 5 },
          timeout: 10000,
        })
      );

      const aiPosts = response.data.posts || [];

      if (aiPosts.length === 0) {
        return {
          user_id: userId,
          total: 0,
          page,
          totalPages: 0,
          posts: [],
        };
      }

      // Step 2: Phân trang
      const startIndex = (page - 1) * limit;
      const paginatedAIPosts = aiPosts.slice(startIndex, startIndex + limit);
      const postIds = paginatedAIPosts.map((p) => p.post_id);

      // Step 3: Query MongoDB
      const posts = await this.postModel
        .find({
          _id: { $in: postIds.map((id) => new Types.ObjectId(id)) },
          isDeleted: false,
        })
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .lean()
        .exec();

      // Step 4: Merge với scores
      const scoreMap = new Map(paginatedAIPosts.map((p) => [p.post_id, p.score]));
      const enrichedPosts = posts
        .map((post) => ({
          ...post,
          aiScore: scoreMap.get(post._id.toString()) || 0,
        }))
        .sort((a, b) => b.aiScore - a.aiScore);

      return {
        user_id: userId,
        total: aiPosts.length,
        page,
        totalPages: Math.ceil(aiPosts.length / limit),
        posts: enrichedPosts,
      };
    } catch (error) {
      console.error('Recommend Error:', error);
      // Fallback: trả về danh sách rỗng
      return {
        user_id: userId,
        total: 0,
        page,
        totalPages: 0,
        posts: [],
      };
    }
  }

  /**
   * Tìm bài viết tương tự
   */
  async similar(postId: string, limit: number = 10): Promise<FullPostResponse> {
    try {
      // Step 1: Gọi AI Server
      const response: AxiosResponse<AIResponse> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/similar/${postId}`, {
          params: { limit },
          timeout: 10000,
        })
      );

      const aiPosts = response.data.posts || [];

      if (aiPosts.length === 0) {
        return {
          post_id: postId,
          total: 0,
          page: 1,
          totalPages: 0,
          posts: [],
        };
      }

      // Step 2: Query MongoDB
      const postIds = aiPosts.map((p) => p.post_id);
      const posts = await this.postModel
        .find({
          _id: { $in: postIds.map((id) => new Types.ObjectId(id)) },
          isDeleted: false,
        })
        .populate('userId', 'firstName lastName avatar username')
        .populate('groupId', 'name avatar privacy')
        .lean()
        .exec();

      // Step 3: Merge với scores
      const scoreMap = new Map(aiPosts.map((p) => [p.post_id, p.score]));
      const enrichedPosts = posts
        .map((post) => ({
          ...post,
          aiScore: scoreMap.get(post._id.toString()) || 0,
        }))
        .sort((a, b) => b.aiScore - a.aiScore);

      return {
        post_id: postId,
        total: aiPosts.length,
        page: 1,
        totalPages: 1,
        posts: enrichedPosts,
      };
    } catch (error) {
      console.error('Similar Error:', error);
      return {
        post_id: postId,
        total: 0,
        page: 1,
        totalPages: 0,
        posts: [],
      };
    }
  }

  /**
   * Kiểm tra AI server status
   */
  async checkStatus() {
    try {
      const response: AxiosResponse<{ ready: boolean; total_posts: number }> = await firstValueFrom(
        this.httpService.get(`${this.aiServerUrl}/status`, {
          timeout: 5000,
        })
      );
      return {
        aiServer: response.data,
        message: response.data.ready ? 'AI Server sẵn sàng' : 'AI Server chưa train',
      };
    } catch (error) {
      return {
        aiServer: { ready: false, total_posts: 0 },
        message: 'AI Server không khả dụng. Đảm bảo đã chạy: python main.py',
      };
    }
  }
}
