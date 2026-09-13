import { Injectable, Logger } from '@nestjs/common';

/**
 * Process-wide socket presence registry shared by every gateway.
 *
 * This intentionally keeps the exact in-memory semantics previously
 * duplicated as module-level `userSockets` maps (single instance per
 * process). Cross-replica deployments still require a Socket.IO Redis
 * adapter plus a distributed store; swap the internals behind this
 * interface when that migration happens.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);
  private readonly userSockets = new Map<string, Set<string>>();

  register(userId: string, socketId: string): void {
    if (!userId || !socketId) return;
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);
  }

  /** Removes one socket; returns true when the user has no sockets left. */
  unregister(userId: string | undefined, socketId: string): boolean {
    if (!userId) return false;
    const sockets = this.userSockets.get(userId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.userSockets.delete(userId);
      return true;
    }
    return false;
  }

  getSockets(userId: string): Set<string> {
    return this.userSockets.get(userId) ?? new Set<string>();
  }

  isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    return !!sockets && sockets.size > 0;
  }

  getOnlineUserIds(): string[] {
    return Array.from(this.userSockets.keys());
  }
}
