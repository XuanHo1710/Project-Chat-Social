import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { AccountService } from 'src/account/account.service';
import { AccountGoogleDto } from 'src/account/dto/account-google-dto';
import { Account } from 'src/account/entities/account.entity';
import { AuthSessionService, RotatedSession } from './auth-session.service';

const ms = require('ms');

interface AuthPayload {
  fullname: string;
  gender: string;
  role: string;
  username: string;
  avatar: string;
  email: string;
  _id: string;
  sub: string;
  av: number;
}

export interface AuthResult {
  access_token: string;
  session_id: string;
  payload: AuthPayload;
  newSessionId?: string;
}

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = bcrypt.hash(randomBytes(32).toString('hex'), 10);

  constructor(
    private readonly accountService: AccountService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  private requiredConfig(name: string): string {
    const value = this.configService.get<string>(name);
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  }

  private refreshTtlMs(): number {
    const parsed = ms(this.requiredConfig('JWT_REFRESH_EXPIRE'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error('JWT_REFRESH_EXPIRE is invalid');
    }
    return parsed;
  }

  private isAdminBlockActive(account: Partial<Account>): boolean {
    if (!account?.isBlocked) return false;
    if (!account?.expireBlockAt) return true;
    return new Date(account.expireBlockAt) > new Date();
  }

  private isSelfBlockActive(account: Partial<Account>): boolean {
    if (!account?.selfBlockedAt || !account?.selfBlockExpireAt) return false;
    return new Date(account.selfBlockExpireAt) > new Date();
  }

  private ensureAccountCanAccess(account: Partial<Account>): void {
    if (account?.isActive === false || account?.isDeleted) {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }
    if (this.isAdminBlockActive(account)) {
      throw new ForbiddenException('Tài khoản đã bị khóa bởi quản trị viên');
    }
    if (this.isSelfBlockActive(account)) {
      throw new ForbiddenException('Tài khoản đang ở trạng thái tự khóa');
    }
  }

  private toPayload(account: Account): AuthPayload {
    const id = account._id.toString();
    return {
      fullname: `${account.firstName || ''} ${account.lastName || ''}`.trim(),
      gender: account.gender,
      role: account.role,
      username: account.username,
      avatar: account.avatar,
      email: account.email,
      _id: id,
      sub: id,
      av: Number(account.authVersion || 0),
    };
  }

  private assertPasswordLength(password: string): void {
    if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException('Mật khẩu không hợp lệ');
    }
  }

  async googleLogin(accountGoogle: AccountGoogleDto): Promise<Account> {
    if (!accountGoogle?.email || !accountGoogle.googleId) {
      throw new BadRequestException('Thông tin tài khoản Google không hợp lệ');
    }

    const email = accountGoogle.email.toLowerCase().trim();
    const existingAccount = await this.accountService.findByEmail(email);
    if (existingAccount) {
      // Auto-link is only allowed for Google-provider accounts; LOCAL accounts
      // (even with an unverified matching email) must never be taken over.
      if (existingAccount.authProvider === 'GOOGLE') {
        if (existingAccount.googleId && existingAccount.googleId !== accountGoogle.googleId) {
          throw new UnauthorizedException('Tài khoản Google không khớp');
        }
        return existingAccount as Account;
      }
      throw new UnauthorizedException('Email already registered with another sign-in method');
    }

    return this.accountService.create({
      username: `google_${accountGoogle.googleId}`,
      password: randomBytes(32).toString('base64url'),
      firstName: accountGoogle.firstName,
      lastName: accountGoogle.lastName,
      email,
      avatar: accountGoogle.picture,
      googleId: accountGoogle.googleId,
      authProvider: 'GOOGLE',
    }) as Promise<Account>;
  }

  async verifyAccount(
    identifier: string,
    plainPassword: string,
    ipAddress = 'unknown',
  ): Promise<Account | null> {
    const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
    if (!normalizedIdentifier || normalizedIdentifier.length > 254) return null;
    this.assertPasswordLength(plainPassword);

    await Promise.all([
      this.authSessionService.assertRateLimit(
        'login-account',
        normalizedIdentifier,
        10,
        15 * 60,
      ),
      this.authSessionService.assertRateLimit('login-ip', ipAddress, 60, 15 * 60),
    ]);

    const account = await this.accountService.findForAuthentication(normalizedIdentifier);

    const passwordHash = account?.password || (await this.dummyPasswordHash);
    const isCorrect = await bcrypt.compare(plainPassword, passwordHash);
    if (!account || !isCorrect || account.authProvider === 'GOOGLE') return null;

    this.ensureAccountCanAccess(account as Partial<Account>);
    await this.authSessionService.clearRateLimit('login-account', normalizedIdentifier);
    return account as Account;
  }

  async login(account: Account): Promise<AuthResult> {
    if (!account) throw new BadRequestException('Tài khoản không tồn tại');
    this.ensureAccountCanAccess(account);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.accountService.recordLogin(account._id.toString(), today);

    const sessionId = randomUUID();
    const payload = this.toPayload(account);
    const accessToken = this.createAccessToken(payload);
    const refreshToken = this.createRefreshToken(payload, sessionId);

    await this.authSessionService.setRefreshToken(
      sessionId,
      refreshToken,
      this.refreshTtlMs(),
      payload._id,
    );

    return { access_token: accessToken, session_id: sessionId, payload };
  }

  async signup(signupData: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<AuthResult> {
    this.assertPasswordLength(signupData.password);
    const newAccount = await this.accountService.create({
      username: signupData.username.trim(),
      password: signupData.password,
      firstName: signupData.firstName.trim(),
      lastName: signupData.lastName.trim(),
      phone: signupData.phone?.trim(),
    });
    return this.login(newAccount as Account);
  }

  async processNewToken(sessionId: string): Promise<AuthResult> {
    try {
      // Reuse detection: a sessionId that has already been rotated must never
      // be silently accepted. Replays within a short grace window are treated
      // as benign duplicate in-flight refreshes (cold start, multiple tabs)
      // and simply mint a fresh session; anything later is theft and revokes
      // every session attributable to the owner.
      const rotated = await this.authSessionService.getRotatedSession(sessionId);
      if (rotated) {
        return await this.resolveRotatedSession(rotated);
      }

      const storedSession = await this.authSessionService.getSession(sessionId);
      if (!storedSession) throw new UnauthorizedException();

      const detailPayload = this.jwtService.verify(storedSession.refreshToken, {
        secret: this.requiredConfig('JWT_REFRESH_TOKEN_SECRET'),
      });
      const accountId = String(detailPayload?.sub || detailPayload?._id || '');
      if (!accountId || detailPayload?.sid !== sessionId) throw new UnauthorizedException();
      if (storedSession.userId && storedSession.userId !== accountId) {
        throw new UnauthorizedException();
      }

      const account = (await this.accountService.findAuthState(accountId)) as Account;
      if (!account) throw new UnauthorizedException();
      if (Number(detailPayload?.av ?? -1) !== Number(account.authVersion || 0)) {
        throw new UnauthorizedException();
      }
      this.ensureAccountCanAccess(account);

      const payload = this.toPayload(account);
      const accessToken = this.createAccessToken(payload);

      // Rotate to a brand-new sessionId so a bare stolen sessionId cannot be
      // refreshed forever. The CAS compare makes concurrent refreshes on the
      // same sessionId mutually exclusive: only the request that observed the
      // live session wins; losers fall back to the winner's tombstone.
      const newSessionId = randomUUID();
      const rotatedRefreshToken = this.createRefreshToken(payload, newSessionId);
      const casResult = await this.authSessionService.rotateSessionCas(
        sessionId,
        newSessionId,
        rotatedRefreshToken,
        this.refreshTtlMs(),
        accountId,
        Number(account.authVersion || 0),
      );

      if (casResult !== 1) {
        // Lost race: another refresh already consumed this sessionId. Re-read
        // state — if its rotation tombstone exists, apply the same grace /
        // reuse-revocation logic to it; otherwise nothing is left to honor.
        const winnerTombstone = await this.authSessionService.getRotatedSession(sessionId);
        if (!winnerTombstone) throw new UnauthorizedException();
        return await this.resolveRotatedSession(winnerTombstone);
      }

      return {
        access_token: accessToken,
        session_id: newSessionId,
        payload,
        newSessionId,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      await this.authSessionService.removeRefreshToken(sessionId).catch(() => undefined);
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  /**
   * Handles a replay of an already-rotated sessionId: benign duplicates inside
   * the grace window get a fresh session, anything older revokes every session
   * attributable to the owner. Sessions whose tombstone records a lower auth
   * version than the account's current one (password changed after rotation)
   * never mint tokens and are revoked outright.
   */
  private async resolveRotatedSession(rotated: RotatedSession): Promise<AuthResult> {
    const graceSeconds = Number(this.configService.get<string>('REFRESH_REUSE_GRACE_SECONDS'));
    const graceMs =
      Number.isFinite(graceSeconds) && graceSeconds >= 0 ? graceSeconds * 1000 : 45_000;
    const withinGrace = rotated.rotatedAt > 0 && Date.now() - rotated.rotatedAt <= graceMs;
    if (!withinGrace) {
      await this.authSessionService.removeAllUserSessions(rotated.userId).catch(() => undefined);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    const account = (await this.accountService.findAuthState(rotated.userId)) as Account;
    if (!account) throw new UnauthorizedException();
    this.ensureAccountCanAccess(account);

    if (
      rotated.av !== undefined &&
      Number(rotated.av) !== Number(account.authVersion || 0)
    ) {
      await this.authSessionService.removeAllUserSessions(rotated.userId).catch(() => undefined);
      throw new UnauthorizedException();
    }

    return await this.issueGraceWindowTokens(rotated.userId, account);
  }

  /**
   * Mints a fresh session for a benign duplicate refresh that replayed a
   * just-rotated sessionId inside the grace window. The old key is already
   * gone, so this only writes the replacement session.
   */
  private async issueGraceWindowTokens(userId: string, account: Account): Promise<AuthResult> {
    const payload = this.toPayload(account);
    const accessToken = this.createAccessToken(payload);
    const newSessionId = randomUUID();
    const refreshToken = this.createRefreshToken(payload, newSessionId);
    await this.authSessionService.setRefreshToken(
      newSessionId,
      refreshToken,
      this.refreshTtlMs(),
      userId,
    );

    return { access_token: accessToken, session_id: newSessionId, payload, newSessionId };
  }

  private createRefreshToken(payload: AuthPayload, sessionId: string): string {
    return this.jwtService.sign(
      { ...payload, sid: sessionId },
      {
        secret: this.requiredConfig('JWT_REFRESH_TOKEN_SECRET'),
        expiresIn: this.requiredConfig('JWT_REFRESH_EXPIRE') as any,
      },
    );
  }

  createAccessToken(payload: AuthPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.requiredConfig('JWT_ACCESS_TOKEN_SECRET'),
      expiresIn: this.requiredConfig('JWT_ACCESS_EXPIRE') as any,
    });
  }

  async createGoogleExchange(result: AuthResult): Promise<string> {
    const code = randomUUID();
    await this.authSessionService.storeOneTimeExchange(code, result, 60);
    return code;
  }

  async exchangeGoogleCode(code: string): Promise<AuthResult> {
    const result = await this.authSessionService.consumeOneTimeExchange<AuthResult>(code);
    if (!result) throw new UnauthorizedException('Mã đăng nhập Google không hợp lệ hoặc đã hết hạn');
    return result;
  }

  /**
   * Resolves the authenticated principal from an optional Authorization
   * header. Returns undefined when no header is supplied (legacy anonymous
   * flows); throws 401 when a header is present but invalid so callers can
   * never downgrade to anonymous by sending garbage credentials.
   */
  async resolveOptionalPrincipalUserId(authorization?: string): Promise<string | undefined> {
    if (!authorization) return undefined;
    if (!authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Malformed Authorization header');
    }
    try {
      const payload = this.jwtService.verify(authorization.slice('Bearer '.length), {
        secret: this.requiredConfig('JWT_ACCESS_TOKEN_SECRET'),
      });
      const userId = String(payload?._id || payload?.sub || '');
      if (!userId) throw new Error('missing subject');
      return userId;
    } catch (error) {
      // An expired access token must not block logout: the caller may still
      // hold a live Redis session via its session cookie, so treat expiry as
      // the anonymous flow (which still deletes the presented sessionId).
      // Any other verification failure keeps the strict 401.
      if (error instanceof TokenExpiredError) return undefined;
      throw new UnauthorizedException('Invalid access token');
    }
  }

  async logout(sessionId?: string, principalUserId?: string): Promise<{ message: string }> {
    if (!sessionId) return { message: 'Success Logout' };

    if (principalUserId) {
      const storedSession = await this.authSessionService.getSession(sessionId);
      if (
        storedSession &&
        storedSession.userId &&
        storedSession.userId !== principalUserId
      ) {
        throw new ForbiddenException('Session does not belong to the authenticated user');
      }
      await this.authSessionService.removeRefreshToken(sessionId, principalUserId);
      return { message: 'Success Logout' };
    }

    await this.authSessionService.removeRefreshToken(sessionId);
    return { message: 'Success Logout' };
  }
}
