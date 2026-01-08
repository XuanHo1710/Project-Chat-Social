import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: '/groups',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
})
export class GroupGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('GroupGateway');

  afterInit() {
    this.logger.log('Group Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGroupRoom')
  handleJoinGroupRoom(client: Socket, groupId: string) {
    client.join(`group:${groupId}`);
    this.logger.log(`Client ${client.id} joined group room: ${groupId}`);
  }

  @SubscribeMessage('leaveGroupRoom')
  handleLeaveGroupRoom(client: Socket, groupId: string) {
    client.leave(`group:${groupId}`);
    this.logger.log(`Client ${client.id} left group room: ${groupId}`);
  }

  // Emit when a member joins/leaves the group
  emitMemberCountUpdate(groupId: string, memberCount: number) {
    this.server.to(`group:${groupId}`).emit('memberCountUpdate', {
      groupId,
      memberCount,
    });
  }

  // Emit when a member's role is changed
  emitRoleUpdate(groupId: string, userId: string, newRole: string, updatedBy: string) {
    this.server.to(`group:${groupId}`).emit('memberRoleUpdate', {
      groupId,
      userId,
      newRole,
      updatedBy,
    });
  }

  // Emit when ownership is transferred
  emitOwnershipTransfer(groupId: string, oldOwnerId: string, newOwnerId: string) {
    this.server.to(`group:${groupId}`).emit('ownershipTransfer', {
      groupId,
      oldOwnerId,
      newOwnerId,
    });
  }

  // Emit when group settings are updated
  emitGroupSettingsUpdate(groupId: string, settings: any) {
    this.server.to(`group:${groupId}`).emit('groupSettingsUpdate', {
      groupId,
      settings,
    });
  }

  // Emit when a new member joins (for real-time list update)
  emitNewMember(groupId: string, member: any) {
    this.server.to(`group:${groupId}`).emit('newMember', {
      groupId,
      member,
    });
  }

  // Emit when a member leaves (for real-time list update)
  emitMemberLeft(groupId: string, userId: string) {
    this.server.to(`group:${groupId}`).emit('memberLeft', {
      groupId,
      userId,
    });
  }
}
