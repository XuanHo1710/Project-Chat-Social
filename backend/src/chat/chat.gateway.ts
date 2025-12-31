import { Logger } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatService } from "src/chat/chat.service";
import { CreateMessageDto } from "src/chat/dto/create-message.dto";
import { ConversationService } from "src/conversation/conversation.service";
import { InjectModel } from "@nestjs/mongoose";
import { Account, AccountDocument } from "src/account/entities/account.entity";
import { Model } from "mongoose";
import { EmotionType } from "./entities/message.entity";

// Map để lưu userId -> Set<socketId> (support multiple connections per user)
const userSockets = new Map<string, Set<string>>();


@WebSocketGateway({
    cors: {
        origin: "*",
        credentials: true,
    },
    namespace: '/chat'
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private logger = new Logger('ChatGateway');

    constructor(
        private readonly conversationService: ConversationService,
        private readonly chatService: ChatService,
        @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
    ) { }


    async handleConnection(client: Socket) {
        try {
            const userId = client.handshake.query.userId as string;

            console.log("Client connected:", client.id, "with userId:", userId);

            if (!userId) {
                this.logger.warn(`Client ${client.id} connected without userId`);
                client.disconnect();
                return;
            }

            // Store userId in client data for later use
            client.data.userId = userId;

            // Check if this is the first connection for this user
            const isFirstConnection = !userSockets.has(userId) || userSockets.get(userId)!.size === 0;

            // Lưu mapping userId -> Set<socketId> (support multiple devices)
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId)!.add(client.id);

            // Join user vào room của chính họ
            client.join(`user:${userId}`);

            // If first connection, update status to ACTIVE
            if (isFirstConnection) {
                await this.accountModel.findByIdAndUpdate(userId, {
                    status: 'ACTIVE',
                    lastLogin: new Date(),
                });

                // Broadcast to all users that this user is now online
                this.server.emit('user:online', {
                    userId,
                    status: 'ACTIVE',
                    lastLogin: new Date()
                });

                this.logger.log(`User ${userId} is now ONLINE`);
            }

            // Join user vào tất cả conversations của họ
            const conversations = await this.conversationService.findConversationByUserId(userId);
            conversations.forEach((conv) => {
                client.join(`room:${conv._id.toString()}`);
                console.log(`User ${userId} joined room: room:${conv._id.toString()}`);
            });

        } catch (error) {
            this.logger.error('Connection error:', error);
        }
    }

    async handleDisconnect(client: Socket) {
        try {
            const userId = client.data.userId || (client.handshake.query.userId as string);

            if (userId && userSockets.has(userId)) {
                const sockets = userSockets.get(userId)!;
                sockets.delete(client.id);

                // Only update status to offline if no more connections for this user
                if (sockets.size === 0) {
                    userSockets.delete(userId);

                    // Update status to DEACTIVE and lastActive
                    const lastActive = new Date();
                    await this.accountModel.findByIdAndUpdate(userId, {
                        status: 'DEACTIVE',
                        lastActive,
                    });

                    // Broadcast to all users that this user is now offline
                    this.server.emit('user:offline', {
                        userId,
                        status: 'DEACTIVE',
                        lastActive
                    });

                    this.logger.log(`User ${userId} is now OFFLINE`);
                }
            }
        } catch (error) {
            this.logger.error('Disconnect error:', error);
        }
    }


    @SubscribeMessage('room')
    async handleJoinConversation(
        @MessageBody() data: { conversationId: string },
        @ConnectedSocket() client: Socket,
    ) {
        client.join(`room:${data.conversationId}`);
        return { success: true };
    }


    @SubscribeMessage('message')
    async handleSendMessage(@MessageBody() data: CreateMessageDto,
        @ConnectedSocket() client: Socket) {

        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const savedMessage = await this.chatService.sendMessage(data);
            if (!savedMessage) {
                return { success: false, error: 'Failed to save message' };
            }

            this.server.to(`room:${data.conversationId.toString()}`).emit('message:new', savedMessage);

            await this.conversationService.updateLastMessage(
                data.conversationId.toString(),
                savedMessage._id.toString()
            );

            return { success: true, message: savedMessage };
        } catch (err) {
            this.logger.error('Failed to save message', err);
            return { success: false, error: 'Failed to save message' };
        }
    }

    // ============ MESSAGE FEATURES ============

    // Chỉnh sửa tin nhắn
    @SubscribeMessage('message:edit')
    async handleEditMessage(
        @MessageBody() data: { messageId: string; conversationId: string; content: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updatedMessage = await this.chatService.editMessage(data.messageId, userId, data.content);
            this.server.to(`room:${data.conversationId}`).emit('message:edited', updatedMessage);
            return { success: true, message: updatedMessage };
        } catch (err) {
            this.logger.error('Failed to edit message', err);
            return { success: false, error: err.message };
        }
    }

    // Thả cảm xúc tin nhắn
    @SubscribeMessage('message:reaction')
    async handleMessageReaction(
        @MessageBody() data: { messageId: string; conversationId: string; emotionType: EmotionType },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updatedMessage = await this.chatService.addReaction(data.messageId, userId, data.emotionType);
            this.server.to(`room:${data.conversationId}`).emit('message:reaction:updated', updatedMessage);
            return { success: true, message: updatedMessage };
        } catch (err) {
            this.logger.error('Failed to add reaction', err);
            return { success: false, error: err.message };
        }
    }

    // Xóa cảm xúc tin nhắn
    @SubscribeMessage('message:reaction:remove')
    async handleRemoveReaction(
        @MessageBody() data: { messageId: string; conversationId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updatedMessage = await this.chatService.removeReaction(data.messageId, userId);
            this.server.to(`room:${data.conversationId}`).emit('message:reaction:updated', updatedMessage);
            return { success: true, message: updatedMessage };
        } catch (err) {
            this.logger.error('Failed to remove reaction', err);
            return { success: false, error: err.message };
        }
    }

    // Xóa tin nhắn
    @SubscribeMessage('message:delete')
    async handleDeleteMessage(
        @MessageBody() data: { messageId: string; conversationId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const deletedMessage = await this.chatService.deleteMessage(data.messageId, userId);
            this.server.to(`room:${data.conversationId}`).emit('message:deleted', deletedMessage);
            return { success: true, message: deletedMessage };
        } catch (err) {
            this.logger.error('Failed to delete message', err);
            return { success: false, error: err.message };
        }
    }

    // ============ CONVERSATION FEATURES ============

    // Thay đổi Quick Reaction
    @SubscribeMessage('conversation:quick-reaction')
    async handleQuickReaction(
        @MessageBody() data: { conversationId: string; emoji: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.updateQuickReaction(data.conversationId, userId, data.emoji);
            this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);
            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Thay đổi nickname của member
    @SubscribeMessage('conversation:nickname')
    async handleNicknameChange(
        @MessageBody() data: { conversationId: string; targetUserId: string; nickname: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.updateMemberNickname(
                data.conversationId, userId, data.targetUserId, data.nickname
            );
            this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);
            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Thay đổi tên nhóm
    @SubscribeMessage('conversation:name')
    async handleGroupNameChange(
        @MessageBody() data: { conversationId: string; name: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.updateGroupName(data.conversationId, userId, data.name);
            this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);
            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Thay đổi avatar nhóm
    @SubscribeMessage('conversation:avatar')
    async handleGroupAvatarChange(
        @MessageBody() data: { conversationId: string; avatarUrl: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.updateGroupAvatar(data.conversationId, userId, data.avatarUrl);
            this.server.to(`room:${data.conversationId}`).emit('conversation:updated', updated);
            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Thêm thành viên
    @SubscribeMessage('conversation:member:add')
    async handleAddMember(
        @MessageBody() data: { conversationId: string; newUserId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.addMember(data.conversationId, userId, data.newUserId);

            // Gửi cho tất cả members hiện tại
            this.server.to(`room:${data.conversationId}`).emit('conversation:member:added', {
                conversation: updated,
                newUserId: data.newUserId
            });

            // Join new member vào room
            const newUserSockets = userSockets.get(data.newUserId);
            if (newUserSockets) {
                newUserSockets.forEach(socketId => {
                    this.server.sockets.sockets.get(socketId)?.join(`room:${data.conversationId}`);
                });
            }

            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Kick thành viên
    @SubscribeMessage('conversation:member:remove')
    async handleRemoveMember(
        @MessageBody() data: { conversationId: string; targetUserId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.removeMember(data.conversationId, userId, data.targetUserId);

            // Thông báo cho tất cả
            this.server.to(`room:${data.conversationId}`).emit('conversation:member:removed', {
                conversation: updated,
                removedUserId: data.targetUserId
            });

            // Remove kicked member khỏi room
            const kickedUserSockets = userSockets.get(data.targetUserId);
            if (kickedUserSockets) {
                kickedUserSockets.forEach(socketId => {
                    this.server.sockets.sockets.get(socketId)?.leave(`room:${data.conversationId}`);
                });
            }

            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Phân quyền admin
    @SubscribeMessage('conversation:admin')
    async handleAdminChange(
        @MessageBody() data: { conversationId: string; targetUserId: string; isAdmin: boolean },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.updateAdminStatus(
                data.conversationId, userId, data.targetUserId, data.isAdmin
            );
            this.server.to(`room:${data.conversationId}`).emit('conversation:admin:updated', updated);
            return { success: true, conversation: updated };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Rời nhóm
    @SubscribeMessage('conversation:leave')
    async handleLeaveGroup(
        @MessageBody() data: { conversationId: string },
        @ConnectedSocket() client: Socket
    ) {
        const userId = client.data.userId;
        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }

        try {
            const updated = await this.conversationService.leaveGroup(data.conversationId, userId);

            // Thông báo cho group
            this.server.to(`room:${data.conversationId}`).emit('conversation:member:left', {
                conversation: updated,
                leftUserId: userId
            });

            // Leave room
            client.leave(`room:${data.conversationId}`);

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // ============ STATUS ============

    // Get online status of a specific user
    @SubscribeMessage('user:status')
    async handleGetUserStatus(
        @MessageBody() data: { userId: string },
        @ConnectedSocket() client: Socket
    ) {
        const isOnline = userSockets.has(data.userId) && userSockets.get(data.userId)!.size > 0;
        return {
            userId: data.userId,
            isOnline,
            status: isOnline ? 'ACTIVE' : 'DEACTIVE'
        };
    }

    // Get list of online users
    @SubscribeMessage('users:online')
    async handleGetOnlineUsers(
        @ConnectedSocket() client: Socket
    ) {
        const onlineUserIds = Array.from(userSockets.keys());
        return { onlineUsers: onlineUserIds };
    }
}