import { BadRequestException, Controller, Logger, NotFoundException } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { Types } from 'mongoose';
import {
  BackendRmqChannel,
  BackendRmqMessage,
  settleBackendRmqFailure,
} from '../common/messaging/rabbitmq-delivery';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

type BrokerRecord = Record<string, unknown>;

class InvalidBrokerPayloadError extends Error {}

@Controller()
export class ChatRabbitMQController {
  private readonly logger = new Logger(ChatRabbitMQController.name);
  private readonly authorizedStreams = new Map<string, number>();
  private readonly streamAuthorizationTtlMs = 10 * 60 * 1000;

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService,
  ) {}

  @EventPattern('chat.ai.stream.start')
  async handleAiStreamStart(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const delivery = this.delivery(context);
    try {
      const payload = this.aiMessagePayload(rawPayload);
      const message = await this.chatService.findAiMessageForBroker(
        payload.messageId,
        payload.conversationId,
      );
      const conversationId = message.conversationId.toString();
      const senderId = this.documentId(message.senderId);
      this.authorizeStream(conversationId, payload.messageId);
      this.chatGateway.server.to(`room:${conversationId}`).emit('chat.ai.stream.start', {
        conversationId,
        messageId: payload.messageId,
        senderId,
      });
      this.ack(delivery);
    } catch (error) {
      await this.handleFailure('chat.ai.stream.start', error, delivery);
    }
  }

  @EventPattern('chat.ai.token')
  async handleAiToken(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const delivery = this.delivery(context);
    try {
      const payload = this.aiTokenPayload(rawPayload);
      if (!this.isStreamAuthorized(payload.conversationId, payload.messageId)) {
        await this.chatService.findAiMessageForBroker(payload.messageId, payload.conversationId);
        this.authorizeStream(payload.conversationId, payload.messageId);
      }
      this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chat.ai.token', payload);
      this.ack(delivery);
    } catch (error) {
      await this.handleFailure('chat.ai.token', error, delivery);
    }
  }

  @EventPattern('chat.ai.stream.done')
  async handleAiStreamDone(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const delivery = this.delivery(context);
    try {
      const payload = this.aiMessagePayload(rawPayload);
      const message = await this.chatService.findAiMessageForBroker(
        payload.messageId,
        payload.conversationId,
      );
      const conversationId = message.conversationId.toString();
      this.authorizedStreams.delete(this.streamKey(conversationId, payload.messageId));
      this.chatGateway.server.to(`room:${conversationId}`).emit('chat.ai.stream.done', {
        ...message.toObject(),
        conversationId,
      });
      this.ack(delivery);
    } catch (error) {
      await this.handleFailure('chat.ai.stream.done', error, delivery);
    }
  }

  @EventPattern('chat.typing')
  async handleTyping(@Payload() rawPayload: unknown, @Ctx() context: RmqContext) {
    const delivery = this.delivery(context);
    try {
      const payload = this.typingPayload(rawPayload);
      if (!(await this.chatService.brokerConversationExists(payload.conversationId))) {
        throw new InvalidBrokerPayloadError('Conversation does not exist');
      }
      this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chatbot:typing', payload);
      this.ack(delivery);
    } catch (error) {
      await this.handleFailure('chat.typing', error, delivery);
    }
  }

  private aiMessagePayload(value: unknown): { conversationId: string; messageId: string } {
    const payload = this.record(value);
    return {
      conversationId: this.objectId(payload.conversationId, 'conversationId'),
      messageId: this.objectId(payload.messageId, 'messageId'),
    };
  }

  private aiTokenPayload(value: unknown): {
    conversationId: string;
    messageId: string;
    token: string;
  } {
    const payload = this.record(value);
    const token = payload.token;
    if (typeof token !== 'string' || token.length === 0 || token.length > 4_096) {
      throw new InvalidBrokerPayloadError('token is invalid');
    }
    return {
      conversationId: this.objectId(payload.conversationId, 'conversationId'),
      messageId: this.objectId(payload.messageId, 'messageId'),
      token,
    };
  }

  private typingPayload(value: unknown): { conversationId: string; isTyping: boolean } {
    const payload = this.record(value);
    if (typeof payload.isTyping !== 'boolean') {
      throw new InvalidBrokerPayloadError('isTyping must be a boolean');
    }
    return {
      conversationId: this.objectId(payload.conversationId, 'conversationId'),
      isTyping: payload.isTyping,
    };
  }

  private record(value: unknown): BrokerRecord {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new InvalidBrokerPayloadError('Broker payload must be an object');
    }
    return value as BrokerRecord;
  }

  private objectId(value: unknown, field: string): string {
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value) || !Types.ObjectId.isValid(value)) {
      throw new InvalidBrokerPayloadError(`${field} is invalid`);
    }
    return value;
  }

  private documentId(value: unknown): string {
    if (value && typeof value === 'object' && '_id' in value) {
      return String((value as { _id: unknown })._id);
    }
    return String(value);
  }

  private streamKey(conversationId: string, messageId: string): string {
    return `${conversationId}:${messageId}`;
  }

  private authorizeStream(conversationId: string, messageId: string): void {
    const now = Date.now();
    if (this.authorizedStreams.size >= 10_000) {
      for (const [key, expiresAt] of this.authorizedStreams) {
        if (expiresAt <= now) this.authorizedStreams.delete(key);
      }
      if (this.authorizedStreams.size >= 10_000) {
        const oldestKey = this.authorizedStreams.keys().next().value as string | undefined;
        if (oldestKey) this.authorizedStreams.delete(oldestKey);
      }
    }
    this.authorizedStreams.set(
      this.streamKey(conversationId, messageId),
      now + this.streamAuthorizationTtlMs,
    );
  }

  private isStreamAuthorized(conversationId: string, messageId: string): boolean {
    const key = this.streamKey(conversationId, messageId);
    const expiresAt = this.authorizedStreams.get(key) || 0;
    if (expiresAt <= Date.now()) {
      this.authorizedStreams.delete(key);
      return false;
    }
    return true;
  }

  private delivery(context: RmqContext): {
    channel: BackendRmqChannel;
    message: BackendRmqMessage;
  } {
    return {
      channel: context.getChannelRef() as BackendRmqChannel,
      message: context.getMessage() as BackendRmqMessage,
    };
  }

  private ack(delivery: {
    channel: BackendRmqChannel;
    message: BackendRmqMessage;
  }): void {
    delivery.channel.ack(delivery.message);
  }

  private async handleFailure(
    pattern: string,
    error: unknown,
    delivery: { channel: BackendRmqChannel; message: BackendRmqMessage },
  ): Promise<void> {
    const message = error instanceof Error ? error.message : 'Unknown broker handler error';
    this.logger.warn(`Rejected ${pattern}: ${message}`);
    await settleBackendRmqFailure({
      ...delivery,
      pattern,
      error,
      permanent:
        error instanceof InvalidBrokerPayloadError ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException,
      logger: this.logger,
    });
  }
}
