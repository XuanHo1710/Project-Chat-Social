import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { socketCorsOptions } from 'src/common/config/cors.config';
import { PresenceService } from 'src/common/presence/presence.service';
import { UserRole } from 'src/common/enums/user-role.enum';

@WebSocketGateway({
  cors: socketCorsOptions,
  namespace: '/notifications',
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly socketAuthService: SocketAuthService,
    private readonly presenceService: PresenceService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const { userId, role } = await this.socketAuthService.authenticate(client);

      // Register socket in the shared presence registry (multiple devices per user)
      this.presenceService.register(userId, client.id);

      // Join user's personal room
      client.join(`user:${userId}`);

      if (role === UserRole.ADMIN || role === UserRole.EMPLOYEE) {
        client.join('admin:dashboard');
      }

      this.logger.log(`User ${userId} connected with socket ${client.id}`);
    } catch {
      this.logger.warn(`Rejected unauthorized notification socket ${client.id}`);
      this.socketAuthService.reject(client);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;

    if (userId) {
      // Remove socket from the shared presence registry
      this.presenceService.unregister(userId, client.id);

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
    return this.presenceService.isOnline(userId);
  }

  // Emit new comment to admin dashboard (real-time)
  emitAdminNewComment(comment: {
    id: string;
    user: string;
    avatar: string;
    content: string;
    time: string;
  }) {
    this.server.to('admin:dashboard').emit('admin:newComment', comment);
    this.logger.log(`Broadcast new comment to admin dashboard: ${comment.id}`);
  }
}
