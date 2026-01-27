/**
 * DTO cho event chat.message.created từ Backend
 */
export class MessageCreatedEventDto {
  messageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  conversationType: 'DIRECT' | 'GROUP' | 'CHATBOT';
  // Data cho AI processing
  isChatbotConversation?: boolean;
  isChatbotMentioned?: boolean;
  chatMessage?: string;
  chatbotName?: string;
  attachments?: Array<{
    mediaType: string;
    url: string;
  }>;
  // Data cho FCM notification
  participantIds?: string[];
  senderName?: string;
  senderAvatar?: string;
}

/**
 * DTO cho event chat.ai.response từ RabbitMQ → Backend
 */
export class AiResponseEventDto {
  conversationId: string;
  senderId: string; // Bot sender ID
  content: string;
  postIdsRecommendation?: string[];
  originalSenderId: string; // User đã trigger chatbot
  success: boolean;
  error?: string;
}

/**
 * DTO cho event chat.typing từ RabbitMQ → Backend
 */
export class TypingEventDto {
  conversationId: string;
  isTyping: boolean;
}
