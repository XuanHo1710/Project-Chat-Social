import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SocketAuthService } from 'src/auth/socket-auth.service';
import { socketCorsOptions } from 'src/common/config/cors.config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GroupMember,
  GroupMemberDocument,
  GroupRole,
  MemberStatus,
} from './entities/group-member.entity';
import { GroupPrivacy, GroupVisibility } from './entities/group.entity';

interface GroupSettingsSocketPayload {
  name: string;
  description: string;
  privacy: GroupPrivacy;
  visibility: GroupVisibility;
  avatar: string | null;
  coverImage: string | null;
}

interface GroupMemberSocketPayload {
  _id: string;
  firstName: string;
  lastName: string;
  avatar?: string | null;
  role: GroupRole;
}

@WebSocketGateway({
  namespace: '/groups',
  cors: socketCorsOptions,
})
export class GroupGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('GroupGateway');

  constructor(
    private readonly socketAuthService: SocketAuthService,
    @InjectModel(GroupMember.name)
    private readonly groupMemberModel: Model<GroupMemberDocument>
  ) {}

  afterInit() {
    this.logger.log('Group Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const { userId } = await this.socketAuthService.authenticate(client);
      this.logger.log(`User ${userId} connected to groups namespace`);
    } catch {
      this.logger.warn(`Rejected unauthorized groups socket ${client.id}`);
      this.socketAuthService.reject(client);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGroupRoom')
  async handleJoinGroupRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string
  ): Promise<{ success: boolean; error?: string }> {
    const socketData: unknown = client.data;
    const rawUserId =
      socketData && typeof socketData === 'object' && 'userId' in socketData
        ? socketData.userId
        : undefined;
    const userId = typeof rawUserId === 'string' ? rawUserId : undefined;
    if (!userId || !Types.ObjectId.isValid(groupId)) {
      return { success: false, error: 'Forbidden' };
    }

    const isApprovedMember = await this.groupMemberModel.exists({
      groupId,
      userId,
      status: MemberStatus.APPROVED,
    });
    if (!isApprovedMember) {
      this.logger.warn(`Denied group room access for user ${userId}`);
      return { success: false, error: 'Forbidden' };
    }

    await client.join(`group:${groupId}`);
    this.logger.log(`Client ${client.id} joined group room: ${groupId}`);
    return { success: true };
  }

  @SubscribeMessage('leaveGroupRoom')
  async handleLeaveGroupRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string
  ): Promise<{ success: boolean }> {
    await client.leave(`group:${groupId}`);
    this.logger.log(`Client ${client.id} left group room: ${groupId}`);
    return { success: true };
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
  emitGroupSettingsUpdate(groupId: string, settings: GroupSettingsSocketPayload) {
    this.server.to(`group:${groupId}`).emit('groupSettingsUpdate', {
      groupId,
      settings,
    });
  }

  // Emit when a new member joins (for real-time list update)
  emitNewMember(groupId: string, member: GroupMemberSocketPayload) {
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
