
import { MessageType } from "@/types/chat";

export type ConversationTypeEnum = "DIRECT" | "GROUP";

export interface ConversationParticipantUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    avatar?: string;
    status?: string;
    lastActive?: string;
}

export interface ConversationResponseData {
    _id: string,
    type: ConversationTypeEnum,
    isBlocked: boolean,
    creator: string; // ID của người tạo nhóm
    name?: string; // Tên nhóm
    avatar?: string; // Avatar nhóm
    quickReaction: string,
    unreadCount: {
        _id: string;
    },
    participants: Array<{
        user: ConversationParticipantUser,
        joinedAt: Date,
        isAdmin: boolean,
        nickname: string
    }>,
    lastMessage?: {
        _id: string,
        type: MessageType,
        content: string,
        createdAt: Date,
        senderId?: string,
        attachments?: string[]
    },
    lastMessageAt?: Date,
}
