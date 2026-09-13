import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { Account } from 'src/account/entities/account.entity';
import { AccountService } from 'src/account/account.service';

export interface SocketPrincipal {
  userId: string;
  role?: string;
  account: Account;
  claims: Record<string, unknown>;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly accountService: AccountService
  ) {}

  async authenticate(client: Socket): Promise<SocketPrincipal> {
    const token = this.extractToken(client);
    const secret = this.configService.get<string>('JWT_ACCESS_TOKEN_SECRET');

    if (!token || !secret) {
      throw new UnauthorizedException('Socket authentication is required');
    }

    let claims: Record<string, unknown>;
    try {
      claims = await this.jwtService.verifyAsync<Record<string, unknown>>(token, { secret });
    } catch {
      throw new UnauthorizedException('Socket access token is invalid or expired');
    }

    const userId = typeof claims._id === 'string' ? claims._id : '';
    if (!userId) {
      throw new UnauthorizedException('Socket token has no user identity');
    }

    const account = await this.accountService.findOne(userId);
    const tokenAuthVersion = Number(claims.av ?? -1);
    if (
      !account ||
      tokenAuthVersion !== Number(account.authVersion || 0) ||
      this.isAccessDenied(account)
    ) {
      throw new UnauthorizedException('Account is blocked, inactive, or unavailable');
    }

    client.data.userId = userId;
    client.data.principal = claims;
    client.data.account = account;

    return {
      userId,
      role: typeof claims.role === 'string' ? claims.role : undefined,
      account: account as Account,
      claims,
    };
  }

  reject(client: Socket): void {
    client.emit('auth:error', { message: 'Unauthorized socket connection' });
    client.disconnect(true);
  }

  private extractToken(client: Socket): string | undefined {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim();
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [scheme, token] = authorization.trim().split(/\s+/, 2);
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }

  private isAccessDenied(account: Account): boolean {
    const now = Date.now();
    const adminBlockActive =
      account.isBlocked && (!account.expireBlockAt || new Date(account.expireBlockAt).getTime() > now);
    const selfBlockActive =
      !!account.selfBlockedAt &&
      !!account.selfBlockExpireAt &&
      new Date(account.selfBlockExpireAt).getTime() > now;

    return account.isDeleted === true || account.isActive === false || adminBlockActive || selfBlockActive;
  }
}
