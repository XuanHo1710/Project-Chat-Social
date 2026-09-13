import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { Account } from 'src/account/entities/account.entity';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  async validate(request: Request, username: string, password: string): Promise<Account> {
    const ipAddress = request.ip || request.socket.remoteAddress || 'unknown';
    const account = await this.authService.verifyAccount(username, password, ipAddress);
    if (!account) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return account;
  }
}
