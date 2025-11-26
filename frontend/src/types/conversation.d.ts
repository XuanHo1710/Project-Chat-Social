
import { AccountType } from "@/schema/account.schema";
import { MessageType } from "@/types/chat";

export type ConversationTypeEnum = "DIRECT" | "GROUP";


export interface ConversationResponseData {
    _id: string,
    type: ConversationTypeEnum,
    isBlocked: boolean,
    quickReaction: string,
    unreadCount: {
        _id: string;
    },
    participants: [
        {
            user: AccountType,
            joinedAt: Date,
            isAdmin: false,
            nickname: ""
        }
    ],
    lastMessage?: {
        _id: string,
        type: MessageType,
        content: string,
        createdAt: Date
    },
    lastMessageAt?: Date,
}