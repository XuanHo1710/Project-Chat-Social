import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
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

interface SuccessResponse {
  success?: boolean;
  chunks?: number;
}

@Injectable()
export class AIServerService {
  private readonly logger = new Logger(AIServerService.name);
  private readonly aiServerUrl: string;
  private readonly internalApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.aiServerUrl = (
      this.configService.get<string>('AI_SERVER_URL') ||
      'http://localhost:8000/api/v1'
    ).replace(/\/+$/, '');
    this.internalApiKey =
      this.configService.get<string>('AI_INTERNAL_API_KEY') || '';
    if (!this.internalApiKey) {
      throw new Error('AI_INTERNAL_API_KEY is required for the Kafka worker');
    }
  }

  private requestOptions(timeout: number) {
    if (!this.internalApiKey) {
      throw new Error(
        'AI_INTERNAL_API_KEY is required for worker-to-AI requests',
      );
    }
    return {
      timeout,
      maxRedirects: 0,
      headers: { 'X-AI-API-Key': this.internalApiKey },
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown AI server error';
  }

  async embedPost(request: EmbedPostRequest): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<SuccessResponse>(
          `${this.aiServerUrl}/embed/post`,
          request,
          this.requestOptions(10_000),
        ),
      );
      if (response.data?.success !== true && response.data?.chunks !== 0) {
        throw new Error('AI server did not confirm post embedding');
      }
      this.logger.debug(`Embedded post ${request.post_id}`);
    } catch (error) {
      this.logger.warn(
        `Failed to embed post ${request.post_id}: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  async trackInteraction(
    userId: string,
    targetId: string,
    interactionType: string,
    eventId: string,
  ): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<SuccessResponse>(
          `${this.aiServerUrl}/interaction`,
          {
            user_id: userId,
            target_id: targetId,
            interaction_type: interactionType,
            event_id: eventId,
          },
          this.requestOptions(5_000),
        ),
      );
      if (response.data?.success !== true) {
        throw new Error('AI server did not confirm interaction tracking');
      }
    } catch (error) {
      this.logger.warn(
        `Failed to track interaction ${eventId}: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }

  async deletePostEmbedding(postId: string): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.delete(
          `${this.aiServerUrl}/embed/post/${encodeURIComponent(postId)}`,
          this.requestOptions(10_000),
        ),
      );
      this.logger.debug(`Deleted post embedding ${postId}`);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        this.logger.debug(`Post embedding ${postId} was already absent`);
        return;
      }
      this.logger.warn(
        `Failed to delete post embedding ${postId}: ${this.errorMessage(error)}`,
      );
      throw error;
    }
  }
}
