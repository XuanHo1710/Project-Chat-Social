import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from 'mongoose';
import { Account } from "src/account/entities/account.entity";
import { Message } from "src/conversation/entities/message.entity";
export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ timestamps: true })
export class Conversation {
    _id: mongoose.Schema.Types.ObjectId;

    @Prop({ enum: ['GROUP', 'DIRECT'], required: true })
    type: string; // 'GROUP' | 'DIRECT' 

    @Prop({ default: false })
    isBlocked: boolean;

    @Prop()
    nickname: string;

    @Prop({ type: String, default: '👍' })
    quickReaction?: string;

    @Prop({ type: String })
    theme?: string;

    @Prop({
        type: { userId: mongoose.Schema.Types.ObjectId, count: Number },
        default: {}
    })
    unreadCount?: {
        userId: mongoose.Schema.Types.ObjectId;
        count: number;
    };

    @Prop({ type: String })
    avatar?: string;  // Dành cho nhóm

    @Prop({ type: [{ userId: mongoose.Schema.Types.ObjectId, joinedAt: Date, isAdmin: Boolean, fullName: String, avatar: String }] })
    participants: [{
        userId: mongoose.Schema.Types.ObjectId;
        fullName: string;
        avatar: string;
        joinedAt: Date;
        isAdmin: boolean;
    }]

    @Prop()
    expireBlockAt: Date;


    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Account.name })
    creator?: mongoose.Schema.Types.ObjectId; // Người tạo nhóm (admin đầu tiên)


    @Prop({ type: mongoose.Schema.Types.ObjectId, ref: Message.name })
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

}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);