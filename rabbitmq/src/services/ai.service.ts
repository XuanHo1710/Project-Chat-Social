import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { firstValueFrom } from 'rxjs';

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
  senderName?: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void | Promise<void>;
  onPostIds: (postIds: string[]) => void | Promise<void>;
  onDone: (fullText: string) => void | Promise<void>;
  onError: (error: string) => void | Promise<void>;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiServerUrl: string;
  private readonly internalApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    config: ConfigService
  ) {
    this.aiServerUrl = (config.get<string>('AI_SERVER_URL') || '').replace(/\/+$/, '');
    this.internalApiKey = config.get<string>('AI_INTERNAL_API_KEY') || '';
    if (!this.aiServerUrl) throw new Error('AI_SERVER_URL is required for the RabbitMQ worker');
    if (!this.internalApiKey) {
      throw new Error('AI_INTERNAL_API_KEY is required for the RabbitMQ worker');
    }
  }

  async getChatBotResponseStream(
    message: string,
    chatHistory: ChatHistory[],
    imageUrls: string[] = [],
    currentUserId: string,
    callbacks: StreamCallbacks
  ): Promise<void> {
    let errorNotified = false;
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.requireUrl()}/chat/bot/stream`,
          { message, chatHistory, imageUrls, currentUserId },
          { ...this.requestOptions(120_000), responseType: 'stream' as const }
        )
      );

      const stream = response.data as Readable;
      let fullText = '';
      let buffer = '';
      let completed = false;

      for await (const chunk of stream) {
        buffer += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        if (Buffer.byteLength(buffer, 'utf8') > 256_000) {
          throw new Error('AI stream event buffer exceeded the safety limit');
        }

        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';
        for (const part of parts) {
          const result = await this.processSseEvent(part, fullText, callbacks);
          fullText = result.fullText;
          if (fullText.length > 5_000) {
            throw new Error('AI response exceeded the maximum message length');
          }
          if (result.done) {
            completed = true;
            stream.destroy();
            break;
          }
        }
        if (completed) break;
      }

      if (!completed && buffer.trim()) {
        const result = await this.processSseEvent(buffer, fullText, callbacks);
        fullText = result.fullText;
        completed = result.done;
      }
      if (fullText.length > 5_000) {
        throw new Error('AI response exceeded the maximum message length');
      }
      if (!completed) {
        if (!fullText) throw new Error('AI stream ended without a response');
        await callbacks.onDone(fullText);
      }
    } catch (error) {
      const messageText = this.errorMessage(error);
      if (!errorNotified) {
        errorNotified = true;
        await callbacks.onError(messageText);
      }
      this.logger.error(`AI stream failed: ${messageText}`);
      throw error;
    }
  }

  private async processSseEvent(
    block: string,
    currentText: string,
    callbacks: StreamCallbacks
  ): Promise<{ fullText: string; done: boolean }> {
    if (!block.trim() || block.trimStart().startsWith(':')) {
      return { fullText: currentText, done: false };
    }

    let eventType = 'message';
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return { fullText: currentText, done: false };

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
    } catch {
      throw new Error('AI server returned malformed SSE JSON');
    }

    if (eventType === 'token' && typeof parsed.token === 'string') {
      if (currentText.length + parsed.token.length > 5_000) {
        throw new Error('AI response exceeded the maximum message length');
      }
      await callbacks.onToken(parsed.token);
      return { fullText: currentText + parsed.token, done: false };
    }
    if (eventType === 'postIds' && Array.isArray(parsed.postIds)) {
      const ids = [
        ...new Set(
          parsed.postIds.filter(
            (id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id)
          )
        ),
      ].slice(0, 100);
      await callbacks.onPostIds(ids);
      return { fullText: currentText, done: false };
    }
    if (eventType === 'done') {
      if (!currentText.trim()) throw new Error('AI stream completed without a response');
      await callbacks.onDone(currentText);
      return { fullText: currentText, done: true };
    }
    if (eventType === 'error') {
      throw new Error(typeof parsed.error === 'string' ? parsed.error : 'AI server stream error');
    }
    return { fullText: currentText, done: false };
  }

  private requireUrl(): string {
    if (!this.aiServerUrl) throw new Error('AI_SERVER_URL is required for chatbot processing');
    if (!this.internalApiKey) {
      throw new Error('AI_INTERNAL_API_KEY is required for worker-to-AI requests');
    }
    return this.aiServerUrl;
  }

  private requestOptions(timeout: number) {
    this.requireUrl();
    return {
      timeout,
      maxRedirects: 0,
      headers: { 'X-AI-API-Key': this.internalApiKey },
    };
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    return 'Unknown AI error';
  }
}
