import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from 'src/account/entities/account.entity';
export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
  _id: mongoose.Schema.Types.ObjectId;

  @Prop({ enum: ['GROUP', 'DIRECT', 'CHATBOT'], required: true })
  type: string; // 'GROUP' | 'DIRECT' | 'CHATBOT'

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop()
  nickname?: string; // Biệt danh trong cuộc trò chuyện nhóm

  @Prop({ type: String, default: '👍' })
  quickReaction?: string;

  @Prop({ type: String })
  theme?: string;

  // UnreadCount cho từng user: Map<userId, count>
  @Prop({ type: Map, of: Number, default: {} })
  unreadCount: Map<string, number>;

  @Prop({ type: String })
  avatar?: string; // Dành cho nhóm

  @Prop({
    type: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: Account.name },
        joinedAt: Date,
        isAdmin: Boolean,
        fullName: String,
        avatar: String,
        nickname: String,
        kickedAt: Date, // Thời điểm thành viên bị kick (null nếu chưa bị kick)
        leftAt: Date, // Thời điểm thành viên tự rời nhóm (null nếu chưa rời)
      },
    ],
  })
  participants: [
    {
      user: mongoose.Schema.Types.ObjectId;
      nickname?: string;
      joinedAt: Date;
      isAdmin: boolean;
      kickedAt?: Date; // Thời điểm thành viên bị kick
      leftAt?: Date; // Thời điểm thành viên tự rời nhóm
    },
  ];

  @Prop()
  expireBlockAt?: Date;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name })
  creator?: mongoose.Schema.Types.ObjectId; // Người tạo nhóm (admin đầu tiên)

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'Message' })
  lastMessage?: mongoose.Schema.Types.ObjectId; // Tin nhắn cuối cùng

  @Prop({ type: Date })
  lastMessageAt?: Date; // Thời gian tin nhắn cuối cùng

  @Prop({ type: Boolean, default: false })
  isActive: boolean; // Trạng thái hoạt động của cuộc trò chuyện

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Array<Date>;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop()
  deletedAt: Date;

  // Group settings
  @Prop({
    type: {
      allowMembersToAdd: { type: Boolean, default: true }, // Cho phép thành viên thêm người mới
      onlyAdminCanChat: { type: Boolean, default: false }, // Chỉ admin mới được nhắn tin
    },
    default: {
      allowMembersToAdd: true,
      onlyAdminCanChat: false,
    },
  })
  settings: {
    allowMembersToAdd: boolean;
    onlyAdminCanChat: boolean;
  };

  // Danh sách user đã tắt thông báo cho conversation này
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: Account.name }], default: [] })
  mutedBy: mongoose.Schema.Types.ObjectId[];
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
