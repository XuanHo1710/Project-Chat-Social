import ApiVideoClient = require('@api.video/nodejs-client');
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiVideoService {
    private client: ApiVideoClient;
    private readonly logger = new Logger(ApiVideoService.name);

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('API_VIDEO_KEY');
        if (apiKey) {
            this.client = new ApiVideoClient({ apiKey });
        } else {
            this.logger.warn('API_VIDEO_KEY is not set. Livestream features will not work.');
        }
    }

    async createLiveStream(name: string) {
        if (!this.client) throw new Error('Api Video Client not initialized');

        try {
            const liveStream = await this.client.liveStreams.create({
                name,
                public: true,
                record: true, // Auto record the stream
            } as any);

            this.logger.log(`Created livestream: ${liveStream.liveStreamId}`);
            return liveStream;
        } catch (error) {
            this.logger.error('Failed to create livestream', error);
            throw error;
        }
    }

    async getLiveStream(liveStreamId: string) {
        if (!this.client) return null;
        try {
            return await this.client.liveStreams.get(liveStreamId);
        } catch (error) {
            this.logger.error(`Failed to get livestream ${liveStreamId}`, error);
            return null;
        }
    }

    async deleteLiveStream(liveStreamId: string) {
        if (!this.client) return;
        try {
            await this.client.liveStreams.delete(liveStreamId);
            this.logger.log(`Deleted livestream: ${liveStreamId}`);
        } catch (error) {
            this.logger.warn(`Failed to delete livestream ${liveStreamId}`, error);
        }
    }
}
