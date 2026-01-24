import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      // Add socket to user's set of sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      // Join user's personal room
      client.join(`user:${userId}`);

      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (userId) {
      // Remove socket from user's set
      this.userSockets.get(userId)?.delete(client.id);

      // Clean up empty sets
      if (this.userSockets.get(userId)?.size === 0) {
        this.userSockets.delete(userId);
      }

      this.logger.log(`User ${userId} disconnected (socket ${client.id})`);
    }
  }

  // Send notification to a specific user
  sendNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('newNotification', notification);
    this.logger.log(`Sent notification to user ${userId}`);
  }

  // Send unread count update
  sendUnreadCountUpdate(userId: string, count: number) {
    this.server.to(`user:${userId}`).emit('unreadCountUpdate', { count });
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size || 0) > 0;
  }

  // Emit new comment to admin dashboard (real-time)
  emitAdminNewComment(comment: {
    id: string;
    user: string;
    avatar: string;
    content: string;
    time: string;
  }) {
    // Broadcast to all connected clients on admin:dashboard room
    this.server.emit('admin:newComment', comment);
    this.logger.log(`Broadcast new comment to admin dashboard: ${comment.id}`);
  }
}
