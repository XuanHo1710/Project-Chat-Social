import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

/**
 * DTOs for RabbitMQ events from consumer service
 */
interface AiResponseEvent {
  conversationId: string;
  messageId: string;
  senderId: string;
  content: string;
  postIdsRecommendation?: string[];
  originalSenderId: string;
  success: boolean;
  error?: string;
}

interface TypingEvent {
  conversationId: string;
  isTyping: boolean;
}

interface AiStreamStartEvent {
  conversationId: string;
  messageId: string;
  senderId: string;
}

interface AiTokenEvent {
  conversationId: string;
  messageId: string;
  token: string;
}

interface AiStreamDoneEvent {
  conversationId: string;
  messageId: string;
  senderId: string;
  content: string;
  postIdsRecommendation?: string[];
  originalSenderId: string;
  success: boolean;
}

/**
 * Controller to handle events from RabbitMQ consumer service
 * These events are emitted back to Backend for socket broadcast
 */
@Controller()
export class ChatRabbitMQController {
  private logger = new Logger('ChatRabbitMQController');

  constructor(
    private readonly chatGateway: ChatGateway,
    private readonly chatService: ChatService
  ) {}

  /**
   * Handle AI chatbot response from RabbitMQ (legacy non-streaming / error fallback)
   */
  @EventPattern('chat.ai.response')
  async handleAiResponse(@Payload() payload: AiResponseEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(`Received AI response for conversation: ${payload.conversationId}`);

    try {
      const message = await this.chatService.findMessageById(payload.messageId);

      if (message) {
        this.chatGateway.server.to(`room:${payload.conversationId}`).emit('message:new', {
          ...message.toObject(),
          conversationId: payload.conversationId,
        });
      }

      if (channel) channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error handling AI response:', error);
      if (channel) channel.nack(originalMsg, false, false);
    }
  }

  /**
   * Streaming started — tells frontend to create a placeholder message bubble
   */
  @EventPattern('chat.ai.stream.start')
  async handleAiStreamStart(@Payload() payload: AiStreamStartEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chat.ai.stream.start', {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        senderId: payload.senderId,
      });

      if (channel) channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error handling AI stream start:', error);
      if (channel) channel.nack(originalMsg, false, false);
    }
  }

  /**
   * Individual token — append to the streaming message bubble
   */
  @EventPattern('chat.ai.token')
  async handleAiToken(@Payload() payload: AiTokenEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chat.ai.token', {
        conversationId: payload.conversationId,
        messageId: payload.messageId,
        token: payload.token,
      });

      if (channel) channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error handling AI token:', error);
      if (channel) channel.nack(originalMsg, false, false);
    }
  }

  /**
   * Streaming done — finalize the message with full content and postIds
   */
  @EventPattern('chat.ai.stream.done')
  async handleAiStreamDone(@Payload() payload: AiStreamDoneEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    this.logger.log(`AI stream done for conversation: ${payload.conversationId}`);

    try {
      // Fetch the finalized message from DB (now has full content + postIds)
      const message = await this.chatService.findMessageById(payload.messageId);

      if (message) {
        this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chat.ai.stream.done', {
          ...message.toObject(),
          conversationId: payload.conversationId,
        });
      }

      if (channel) channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error handling AI stream done:', error);
      if (channel) channel.nack(originalMsg, false, false);
    }
  }

  /**
   * Handle typing indicator from RabbitMQ
   */
  @EventPattern('chat.typing')
  async handleTyping(@Payload() payload: TypingEvent, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chatbot:typing', {
        conversationId: payload.conversationId,
        isTyping: payload.isTyping,
      });

      if (channel) channel.ack(originalMsg);
    } catch (error) {
      this.logger.error('Error handling typing event:', error);
      if (channel) channel.nack(originalMsg, false, false);
    }
  }
}
