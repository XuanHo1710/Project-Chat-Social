
export type EmotionType = "LIKE" | "LOVE" | "FUNNY" | "SAD" | "ANGRY";

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "POST";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";

export interface MessageResponse {
    conversationId: Types.ObjectId;

    senderId: Types.ObjectId;

    type: MessageType;

    content: string;

    emotions?: {
        userId: Types.ObjectId;
        emotionType: EmotionType; // Loại cảm xúc, ví dụ: 'LIKE', 'LOVE', 'FUNNY', 'SAD', 'ANGRY'
    }

    attachments?: string[]; // Danh sách file đính kèm

    replyTo?: Types.ObjectId; // Tin nhắn được reply

    postId?: Types.ObjectId;

    // postData?: any; 

    status?: MessageStatus;

    readBy?: Types.ObjectId[];

    createdAt: Date;

}

export interface SendMessagePayload {
    conversationId: string;
    senderId: string;
    type: MessageType;
    content: string;
    attachments?: string[];
    replyTo?: string;
    postId?: string;
}