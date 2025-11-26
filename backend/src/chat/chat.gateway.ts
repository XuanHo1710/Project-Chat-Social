import { Logger, UseGuards } from "@nestjs/common";
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Model } from "mongoose";
import { Server, Socket } from "socket.io";
import { Account } from "src/account/entities/account.entity";
import { ChatService } from "src/chat/chat.service";
import { CreateMessageDto } from "src/chat/dto/create-message.dto";
import { Message } from "src/chat/entities/message.entity";
import { ConversationService } from "src/conversation/conversation.service";

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

            // Lưu mapping userId -> Set<socketId> (support multiple devices)
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId)!.add(client.id);

            // Join user vào room của chính họ
            client.join(`user:${userId}`);

            // Join user vào tất cả conversations của họ
            const conversations = await this.conversationService.findConversationByUserId(userId);
            conversations.forEach((conv) => {
                client.join(`room:${conv._id.toString()}`);
                console.log(`User ${userId} joined room: room:${conv._id.toString()}`);
            });

        } catch {

        }
    }

    async handleDisconnect(client: Socket) {
        try {
            const userId = client.data.userId || (client.handshake.query.userId as string);

            if (userId && userSockets.has(userId)) {
                const sockets = userSockets.get(userId)!;
                sockets.delete(client.id);

                // Only broadcast offline if no more connections for this user
                if (sockets.size === 0) {
                    userSockets.delete(userId);

                    // Update lastActive when user goes offline
                    // const lastActive = new Date();
                    // await this.userModel.findByIdAndUpdate(userId, {
                    //     lastActive,
                    // });
                    // this.server.emit('user:offline', { userId, lastActive });
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
    handleSendMessage(@MessageBody() data: CreateMessageDto,
        @ConnectedSocket() client: Socket) {

        const userId = client.data.userId;

        if (!userId) {
            return { success: false, error: 'User not authenticated' };
        }


        data["createdAt"] = new Date();

        // Gửi data đến tất cả các client trong phòng tương ứng với conversationId
        this.server.to(`room:${data.conversationId.toString()}`).emit('message:new', data);


        // Khỏi cần asyn await vì socket nó không cần thiết mấy cái quỷ này

        this.chatService.sendMessage(data)
            .then(msg => {
                // Cập nhật lastMessage
                this.conversationService.updateLastMessage(data.conversationId.toString(), msg._id.toString())
                    .catch(err => this.logger.error('Failed to update last message', err));
            })
            .catch(err => this.logger.error('Failed to save message', err));
    }




}