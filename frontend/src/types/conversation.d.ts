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

export interface ConversationParticipant {
  user: ConversationParticipantUser;
  joinedAt: Date;
  isAdmin: boolean;
  nickname: string;
  kickedAt?: Date; // Thời điểm thành viên bị kick (null nếu chưa bị kick)
  leftAt?: Date; // Thời điểm thành viên tự rời nhóm (null nếu chưa rời)
}

export interface ConversationSettings {
  allowMembersToAdd: boolean; // Cho phép thành viên thêm người mới
  onlyAdminCanChat: boolean; // Chỉ admin mới được nhắn tin
}

export interface ConversationResponseData {
  _id: string;
  type: ConversationTypeEnum;
  isBlocked: boolean;
  blockedByMe?: boolean; // Current user has blocked the other user (DIRECT only)
  isDeleted?: boolean; // Nhóm đã bị giải tán
  deletedAt?: Date; // Thời điểm giải tán
  creator: string; // ID của người tạo nhóm
  nickname?: string; // Tên nhóm
  avatar?: string; // Avatar nhóm
  quickReaction: string;
  theme?: string; // Theme color for chat background
  unreadCount?: Record<string, number>; // Map userId -> unread count
  settings?: ConversationSettings; // Group settings
  participants: ConversationParticipant[];
  lastMessage?: {
    _id: string;
    type: MessageType;
    content: string;
    createdAt: Date;
    senderId?: string;
    attachments?: string[];
  };
  lastMessageAt?: Date;
}
