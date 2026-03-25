import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { EventEmitter } from 'events';

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

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onPostIds: (postIds: string[]) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

@Injectable()
export class AiService {
  private logger = new Logger('AiService');
  private readonly aiServerUrl: string;

  constructor(private readonly httpService: HttpService) {
    this.aiServerUrl = process.env.AI_SERVER_URL || '';
  }

  /**
   * Send chat message to AI server and get response (legacy non-streaming)
   */
  async getChatBotResponse(
    message: string,
    chatHistory: ChatHistory[],
    imageUrls: string[] = []
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
          { timeout: 120000 }
        )
      );

      this.logger.log('AI server response received');
      return response.data;
    } catch (error) {
      this.logger.error('AI server error:', error.message);
      throw error;
    }
  }

  /**
   * Stream chat response from AI server via SSE
   * Calls callbacks as tokens arrive
   */
  async getChatBotResponseStream(
    message: string,
    chatHistory: ChatHistory[],
    imageUrls: string[] = [],
    callbacks: StreamCallbacks
  ): Promise<void> {
    const url = `${this.aiServerUrl}/chat/bot/stream`;
    this.logger.log(`Streaming AI response: ${message.substring(0, 50)}...`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          { message, chatHistory, imageUrls },
          {
            responseType: 'stream',
            timeout: 120000,
          }
        )
      );

      const stream = response.data as NodeJS.ReadableStream;
      let fullText = '';
      let buffer = '';

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();

          // Process complete SSE events
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || ''; // Keep incomplete part in buffer

          for (const part of parts) {
            if (!part.trim()) continue;

            let eventType = 'message';
            let data = '';

            for (const line of part.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                data = line.slice(6);
              }
            }

            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              switch (eventType) {
                case 'token':
                  if (parsed.token) {
                    fullText += parsed.token;
                    callbacks.onToken(parsed.token);
                  }
                  break;
                case 'postIds':
                  if (parsed.postIds) {
                    callbacks.onPostIds(parsed.postIds);
                  }
                  break;
                case 'done':
                  callbacks.onDone(fullText);
                  resolve();
                  return;
                case 'error':
                  callbacks.onError(parsed.error || 'Unknown error');
                  reject(new Error(parsed.error));
                  return;
              }
            } catch {
              // Ignore JSON parse errors for malformed chunks
            }
          }
        });

        stream.on('end', () => {
          if (fullText) {
            callbacks.onDone(fullText);
          }
          resolve();
        });

        stream.on('error', (err: Error) => {
          callbacks.onError(err.message);
          reject(err);
        });
      });
    } catch (error) {
      this.logger.error('AI stream error:', error.message);
      callbacks.onError(error.message);
      throw error;
    }
  }
}
