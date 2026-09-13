import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountService } from 'src/account/account.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private readonly accountService: AccountService
  ) {
    const secret = configService.get<string>('JWT_ACCESS_TOKEN_SECRET');

    if (!secret) {
      throw new Error('JWT_ACCESS_TOKEN_SECRET is not defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const account = await this.accountService.findAuthState(payload?._id);

    if (!account) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    if (Number(payload?.av ?? -1) !== Number(account.authVersion || 0)) {
      throw new UnauthorizedException('Phiên đăng nhập đã bị thu hồi');
    }

    const now = new Date();
    const isAdminBlockActive =
      !!account.isBlocked && (!account.expireBlockAt || new Date(account.expireBlockAt) > now);
    const isSelfBlockActive =
      !!account.selfBlockedAt &&
      !!account.selfBlockExpireAt &&
      new Date(account.selfBlockExpireAt) > now;

    if (account.isActive === false || isAdminBlockActive || isSelfBlockActive) {
      throw new ForbiddenException('Tài khoản đã bị khóa hoặc vô hiệu hóa');
    }

    return { ...payload };
  }
}
