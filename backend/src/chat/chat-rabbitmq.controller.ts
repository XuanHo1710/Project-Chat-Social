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

/**
 * Controller to handle events from RabbitMQ consumer service
 * These events are emitted back to Backend for socket broadcast
 */
@Controller()
export class ChatRabbitMQController {
    private logger = new Logger('ChatRabbitMQController');

    constructor(
        private readonly chatGateway: ChatGateway,
        private readonly chatService: ChatService,
    ) { }

    /**
     * Handle AI chatbot response from RabbitMQ
     * Emit the message to connected clients
     */
    @EventPattern('chat.ai.response')
    async handleAiResponse(
        @Payload() payload: AiResponseEvent,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        this.logger.log(`Received AI response for conversation: ${payload.conversationId}`);

        try {
            // Get the saved message from DB to emit to clients
            const message = await this.chatService.findMessageById(payload.messageId);

            if (message) {
                // Emit message to all clients in the conversation room
                this.chatGateway.server.to(`room:${payload.conversationId}`).emit('message:new', {
                    ...message.toObject(),
                    conversationId: payload.conversationId,
                });

                this.logger.log(`AI message emitted to room: ${payload.conversationId}`);
            }

            // Acknowledge message
            if (channel) {
                channel.ack(originalMsg);
            }
        } catch (error) {
            this.logger.error('Error handling AI response:', error);
            if (channel) {
                channel.nack(originalMsg, false, false);
            }
        }
    }

    /**
     * Handle typing indicator from RabbitMQ
     * Emit to connected clients
     */
    @EventPattern('chat.typing')
    async handleTyping(
        @Payload() payload: TypingEvent,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef();
        const originalMsg = context.getMessage();

        try {
            // Emit typing indicator to all clients in the conversation room
            this.chatGateway.server.to(`room:${payload.conversationId}`).emit('chatbot:typing', {
                conversationId: payload.conversationId,
                isTyping: payload.isTyping,
            });

            // Acknowledge message
            if (channel) {
                channel.ack(originalMsg);
            }
        } catch (error) {
            this.logger.error('Error handling typing event:', error);
            if (channel) {
                channel.nack(originalMsg, false, false);
            }
        }
    }
}
