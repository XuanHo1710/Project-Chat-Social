import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ChatHistory {
    role: 'user' | 'assistant';
    content: string;
    senderName?: string;
}

interface AiResponse {
    message: string;
    response: string;
    postIds?: string[];
}

@Injectable()
export class AiService {
    private logger = new Logger('AiService');
    private readonly aiServerUrl: string;

    constructor(private readonly httpService: HttpService) {
        this.aiServerUrl = process.env.AI_SERVER_URL || '';
    }

    /**
     * Send chat message to AI server and get response
     */
    async getChatBotResponse(
        message: string,
        chatHistory: ChatHistory[],
        imageUrls: string[] = [],
    ): Promise<AiResponse> {
        try {
            this.logger.log(`Calling AI server with message: ${message.substring(0, 50)}...`);

            const response = await firstValueFrom(
                this.httpService.post<AiResponse>(
                    `${this.aiServerUrl}/chat/bot`,
                    {
                        message,
                        chatHistory,
                        imageUrls,
                    },
                    { timeout: 120000 }, // 2 min timeout for vision analysis
                ),
            );

            this.logger.log('AI server response received');
            return response.data;
        } catch (error) {
            this.logger.error('AI server error:', error.message);
            throw error;
        }
    }
}
