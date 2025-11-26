
import { AccountType } from "@/schema/account.schema";

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
    lastMessage?: string,
    lastMessageAt?: Date,
}